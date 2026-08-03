"""AI 採買推薦的情境快取優先、single-flight 與三角色規則備援流程。"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import threading
import time
from collections.abc import Callable

import pandas as pd

from backend.cache import get_current_prices, price_cache
from src.anomaly.price_status import get_all_price_statuses
from src.data.price_repository import load_price_history

from .cache_repository import (
    CacheBackendError,
    CacheCorruptError,
    CacheWriteError,
    RecommendationCacheRepository,
    build_recommendation_cache_repository,
)
from .category_catalog import (
    SCHEMA_VERSION,
    CategoryDefinition,
    cache_key_for,
    get_category,
    market_matches_region,
    normalize_recommendation_filters,
)
from .llm_recommendation_client import (
    OpenAICompatibleRecommendationClient,
    RecommendationLLMClient,
)
from .recommendation_models import (
    CategoryInfo,
    RecommendationDocument,
    RecommendationItem,
    RoleRecommendationBundle,
    RoleRecommendationContent,
    SourceSummary,
)
from .role_prompts import PROMPT_SET_VERSION, ROLE_PROMPT_DEFINITIONS


logger = logging.getLogger(__name__)


class RecommendationSourceUnavailable(RuntimeError):
    """Official/current price source could not provide candidates."""


class RecommendationDataUnavailable(RuntimeError):
    """There are no valid candidates for the selected category."""


@dataclass(frozen=True)
class RecommendationResult:
    document: RecommendationDocument
    cache_hit: bool
    llm_called: bool
    cache_backend: str

    def as_response(self) -> dict:
        data = self.document.model_dump(mode="json")
        consumer_recommendation = data["role_recommendations"]["consumer"]

        # Additive compatibility aliases for callers that still expect the original
        # single consumer recommendation payload.
        data["recommendation"] = consumer_recommendation
        return {
            "category": self.document.category.key,
            "region": self.document.region,
            "market": self.document.market,
            "cache_hit": self.cache_hit,
            "llm_called": self.llm_called,
            "cache_backend": self.cache_backend,
            "generation_source": "rule_fallback" if self.document.generator == "rules-fallback" else "llm",
            "generated_at": data["generated_at"],
            "data_status": self.document.source_summary.data_status,
            "source_name": self.document.source_summary.source_name,
            "prompt_set_version": self.document.prompt_set_version,
            "data": data,
            "role_recommendations": data["role_recommendations"],
            "recommendations": consumer_recommendation["items"],
        }


class _LockEntry:
    def __init__(self):
        self.lock = threading.Lock()
        self.users = 0


class RecommendationService:
    def __init__(
        self,
        repository: RecommendationCacheRepository,
        llm_client: RecommendationLLMClient,
        price_loader: Callable[[], pd.DataFrame] | None = None,
    ):
        self.repository = repository
        self.llm_client = llm_client
        self.price_loader = price_loader or (lambda: load_price_history(days=30))
        self._locks: dict[str, _LockEntry] = {}
        self._locks_guard = threading.Lock()

    @classmethod
    def from_environment(cls) -> "RecommendationService":
        return cls(
            repository=build_recommendation_cache_repository(),
            llm_client=OpenAICompatibleRecommendationClient(),
        )

    def get_recommendation(
        self,
        category_key: str,
        region: str | None = None,
        market: str | None = None,
    ) -> RecommendationResult:
        started = time.perf_counter()
        category = get_category(category_key)
        region, market = normalize_recommendation_filters(region, market)
        cache_key = cache_key_for(category.key, region, market)

        cached = self._read_existing(category, cache_key, region, market)
        if cached is not None:
            self._log_result(category, cache_key, cached, cache_hit=True, llm_called=False, started=started)
            return RecommendationResult(cached, cache_hit=True, llm_called=False, cache_backend=self.repository.backend_name)

        entry = self._acquire_lock(cache_key)
        try:
            cached = self._read_existing(category, cache_key, region, market)
            if cached is not None:
                self._log_result(category, cache_key, cached, cache_hit=True, llm_called=False, started=started)
                return RecommendationResult(cached, cache_hit=True, llm_called=False, cache_backend=self.repository.backend_name)

            candidates, source_summary = self._load_candidates(category, region, market)
            if not candidates:
                raise RecommendationDataUnavailable(f"分類沒有可用行情候選品項: {category.key}")

            input_digest = self._input_digest(category, candidates, source_summary, region, market)
            prompt = self._build_prompt(category, candidates, source_summary, region, market)
            llm_called = True
            try:
                raw = self.llm_client.generate(prompt)
                document = self._document_from_llm(
                    category,
                    raw,
                    candidates,
                    source_summary,
                    input_digest,
                    region,
                    market,
                )
            except Exception as exc:
                logger.warning(
                    "recommendation_llm_failed",
                    extra={"category": category.key, "cache_key": cache_key, "error_type": type(exc).__name__},
                )
                document = self._document_from_rules(
                    category,
                    candidates,
                    source_summary,
                    input_digest,
                    region,
                    market,
                )

            try:
                created = self.repository.create_if_absent(cache_key, document.model_dump(mode="json"))
            except CacheWriteError:
                logger.error(
                    "recommendation_cache_write_failed",
                    extra={"category": category.key, "cache_key": cache_key, "cache_backend": self.repository.backend_name},
                )
                raise

            if created:
                self._log_result(category, cache_key, document, cache_hit=False, llm_called=llm_called, started=started)
                return RecommendationResult(document, cache_hit=False, llm_called=llm_called, cache_backend=self.repository.backend_name)

            # Another instance may have won the race. Never report our unpersisted document.
            persisted = self._read_existing(category, cache_key, region, market)
            if persisted is None:
                raise CacheBackendError(f"推薦快取寫入競態後無法讀回: {cache_key}")
            self._log_result(category, cache_key, persisted, cache_hit=True, llm_called=False, started=started)
            return RecommendationResult(persisted, cache_hit=True, llm_called=False, cache_backend=self.repository.backend_name)
        finally:
            self._release_lock(cache_key, entry)

    def _acquire_lock(self, cache_key: str) -> _LockEntry:
        with self._locks_guard:
            entry = self._locks.get(cache_key)
            if entry is None:
                entry = _LockEntry()
                self._locks[cache_key] = entry
            entry.users += 1
        entry.lock.acquire()
        return entry

    def _release_lock(self, cache_key: str, entry: _LockEntry) -> None:
        entry.lock.release()
        with self._locks_guard:
            entry.users -= 1
            if entry.users == 0 and self._locks.get(cache_key) is entry:
                self._locks.pop(cache_key, None)

    def _log_result(self, category, cache_key, document, cache_hit, llm_called, started):
        logger.info(
            "recommendation_result",
            extra={
                "category": category.key,
                "cache_key": cache_key,
                "cache_backend": self.repository.backend_name,
                "cache_hit": cache_hit,
                "llm_called": llm_called,
                "generator": document.generator,
                "prompt_set_version": document.prompt_set_version,
                "role_count": len(ROLE_PROMPT_DEFINITIONS),
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                "error_type": None,
            },
        )

    def _read_existing(
        self,
        category: CategoryDefinition,
        cache_key: str,
        region: str | None,
        market: str | None,
    ) -> RecommendationDocument | None:
        try:
            if not self.repository.exists(cache_key):
                return None
            raw = self.repository.read(cache_key)
            document = RecommendationDocument.model_validate(raw)
            if (
                document.cache_key != category.key
                or document.cache_object_key != cache_key
                or document.category.key != category.key
                or document.region != region
                or document.market != market
            ):
                raise CacheCorruptError(f"推薦快取情境不一致: {cache_key}")
            self._validate_role_metadata(document)
            return document
        except CacheCorruptError:
            logger.error(
                "recommendation_cache_corrupt",
                extra={"category": category.key, "cache_key": cache_key, "cache_backend": self.repository.backend_name, "error_type": "CacheCorruptError"},
            )
            raise
        except ValueError as exc:
            logger.error(
                "recommendation_cache_schema_invalid",
                extra={"category": category.key, "cache_key": cache_key, "cache_backend": self.repository.backend_name, "error_type": type(exc).__name__},
            )
            raise CacheCorruptError(f"推薦快取 schema 不合法: {cache_key}") from exc

    def _load_candidates(
        self,
        category: CategoryDefinition,
        region: str | None = None,
        market: str | None = None,
    ) -> tuple[list[dict], SourceSummary]:
        try:
            prices = price_cache.get("prices")
            if prices is None:
                prices = self.price_loader()
            else:
                # The API process may outlive the daily price ingestion job.
                # Re-check the live cache before building recommendation
                # candidates, while preserving explicitly injected frames in
                # tests and offline callers.
                prices = get_current_prices()
        except Exception as exc:
            raise RecommendationSourceUnavailable("行情資料來源無法讀取") from exc

        if not isinstance(prices, pd.DataFrame) or prices.empty:
            return [], SourceSummary(candidate_count=0)

        data = prices.copy()
        if "product_name" not in data.columns and "crop_name" in data.columns:
            data["product_name"] = data["crop_name"]
        required = {"product_name", "market_name", "avg_price", "trans_date"}
        if not required.issubset(data.columns):
            raise RecommendationSourceUnavailable("行情資料缺少推薦所需欄位")
        mask = data["product_name"].fillna("").astype(str).map(category.matches)
        filtered = data.loc[mask].copy()
        if market:
            filtered = filtered[filtered["market_name"].astype(str) == market]
        elif region:
            filtered = filtered[
                filtered["market_name"].astype(str).map(
                    lambda market_name: market_matches_region(market_name, region)
                )
            ]
        if filtered.empty:
            return [], self._source_summary(filtered, 0)

        try:
            statuses = get_all_price_statuses(prices=filtered)
        except Exception as exc:
            raise RecommendationSourceUnavailable("行情價格狀態無法計算") from exc
        rank = {"便宜": 0, "正常": 1, "偏貴": 2, "資料不足": 3}
        statuses = sorted(statuses, key=lambda row: (rank.get(row.get("status"), 3), row.get("product_name", "")))[:12]
        return statuses, self._source_summary(filtered, len(statuses))

    @staticmethod
    def _source_summary(data: pd.DataFrame, candidate_count: int) -> SourceSummary:
        latest = pd.to_datetime(data["trans_date"], errors="coerce").max() if "trans_date" in data else pd.NaT
        latest_trade_date = None if pd.isna(latest) else latest.strftime("%Y-%m-%d")
        source_name = data.attrs.get("source") or "行情資料來源未標示"
        data_status = "official" if str(source_name).lower() == "supabase" else "cached"
        return SourceSummary(
            candidate_count=candidate_count,
            latest_trade_date=latest_trade_date,
            historical_data=bool(data.attrs.get("is_historical", False)),
            data_status=data_status,
            source_name=str(source_name),
        )

    @staticmethod
    def _input_digest(
        category: CategoryDefinition,
        candidates: list[dict],
        source_summary: SourceSummary,
        region: str | None = None,
        market: str | None = None,
    ) -> str:
        raw = json.dumps(
            {
                "category": category.key,
                "region": region,
                "market": market,
                "prompt_set_version": PROMPT_SET_VERSION,
                "candidates": candidates,
                "source_summary": source_summary.model_dump(),
            },
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:16]

    @staticmethod
    def _build_prompt(
        category: CategoryDefinition,
        candidates: list[dict],
        source_summary: SourceSummary,
        region: str | None = None,
        market: str | None = None,
    ) -> str:
        content_schema = {
            "summary": "string",
            "market_outlook": "string",
            "shopping_strategy": "string",
            "items": [
                {
                    "product_name": "candidate product_name",
                    "market_name": "candidate market_name or null",
                    "price_status": "便宜|正常|偏貴|資料不足",
                    "today_price": "candidate today_price or null",
                    "recent_average": "candidate recent_average or null",
                    "action": "string",
                    "reason": "string",
                    "priority": "high|medium|low",
                    "substitute": "candidate product_name or null",
                }
            ],
        }
        return json.dumps(
            {
                "task": "使用同一份正式行情候選資料，依三套角色提示語分別產生消費者、農民與商家建議；三份結果必須一次回傳。",
                "prompt_set_version": PROMPT_SET_VERSION,
                "category": category.as_dict(),
                "selection": {
                    "region": region,
                    "market": market,
                    "instruction": "推薦只能根據此區域與市場的候選行情產生。",
                },
                "source_summary": source_summary.model_dump(),
                "candidates": candidates,
                "role_prompts": {
                    definition.key: definition.as_prompt_dict()
                    for definition in ROLE_PROMPT_DEFINITIONS
                },
                "output_schema": {
                    "role_recommendations": {
                        definition.key: content_schema
                        for definition in ROLE_PROMPT_DEFINITIONS
                    }
                },
                "shared_rules": [
                    "只輸出 JSON object，不要 Markdown。",
                    "必須完整輸出 consumer、farmer、merchant 三個 key，不得缺少角色。",
                    "每個角色最多 6 個 items，只能選 candidates 已存在的品項。",
                    "不得修改 candidates 的市場、價格、近期平均或價格狀態。",
                    "substitute 若有值，只能使用 candidates 已存在的品項。",
                    "不得虛構產地、天氣、產量、庫存、需求、營養、食安、成本或供應資訊。",
                    "不得做保證性價格預測、獲利保證或醫療建議。",
                    "三個角色的 summary、market_outlook、shopping_strategy 與 action 必須反映各自提示語，不得只複製相同內容。",
                ],
            },
            ensure_ascii=False,
        )

    def _document_from_llm(
        self,
        category,
        raw,
        candidates,
        source_summary,
        input_digest,
        region=None,
        market=None,
    ) -> RecommendationDocument:
        expected_roles = {definition.key for definition in ROLE_PROMPT_DEFINITIONS}
        role_payload = raw.get("role_recommendations") if isinstance(raw, dict) else None
        # Gemini may return the three role objects as a top-level array even
        # when the prompt requests the equivalent named object. Normalize only
        # this unambiguous shape; all fields still pass the same Pydantic and
        # candidate-integrity validation below.
        if role_payload is None and isinstance(raw, list):
            role_payload = {}
            for content in raw:
                if not isinstance(content, dict) or content.get("role") not in expected_roles:
                    raise ValueError("LLM 角色陣列格式不合法")
                role = content["role"]
                if role in role_payload:
                    raise ValueError("LLM 重複輸出角色")
                normalized = dict(content)
                normalized.pop("role", None)
                normalized.pop("role_label", None)
                normalized.pop("perspective", None)
                role_payload[role] = normalized
        if not isinstance(role_payload, dict):
            raise ValueError("LLM role_recommendations 不是 object")

        if set(role_payload) != expected_roles:
            raise ValueError("LLM 未完整輸出三個正式角色")

        normalized_roles = {}
        for definition in ROLE_PROMPT_DEFINITIONS:
            content = role_payload.get(definition.key)
            if not isinstance(content, dict):
                raise ValueError(f"LLM 角色內容不是 object: {definition.key}")
            content = dict(content)
            content.pop("role", None)
            content.pop("role_label", None)
            content.pop("perspective", None)
            normalized_roles[definition.key] = RoleRecommendationContent(
                role=definition.key,
                role_label=definition.label,
                perspective=definition.perspective,
                **content,
            )

        payload = {
            "schema_version": SCHEMA_VERSION,
            "prompt_set_version": PROMPT_SET_VERSION,
            "cache_key": category.key,
            "cache_object_key": cache_key_for(category.key, region, market),
            "category": category.as_dict(),
            "generated_at": datetime.now(timezone.utc),
            "generator": "llm",
            "provider": getattr(self.llm_client, "provider", "openai-compatible"),
            "model": getattr(self.llm_client, "model", None),
            "region": region,
            "market": market,
            "input_digest": input_digest,
            "source_summary": source_summary.model_dump(),
            "role_recommendations": RoleRecommendationBundle(**normalized_roles),
        }
        document = RecommendationDocument.model_validate(payload)
        self._validate_role_metadata(document)
        self._validate_candidate_integrity(document, candidates)
        return document

    @staticmethod
    def _validate_role_metadata(document: RecommendationDocument) -> None:
        for definition in ROLE_PROMPT_DEFINITIONS:
            content = getattr(document.role_recommendations, definition.key)
            if content.role != definition.key:
                raise ValueError(f"推薦角色 key 不一致: {definition.key}")
            if content.role_label != definition.label:
                raise ValueError(f"推薦角色名稱不一致: {definition.key}")
            if content.perspective != definition.perspective:
                raise ValueError(f"推薦角色視角不一致: {definition.key}")

    @staticmethod
    def _validate_candidate_integrity(document: RecommendationDocument, candidates: list[dict]) -> None:
        allowed = {candidate["product_name"] for candidate in candidates}
        candidate_by_product = {candidate["product_name"]: candidate for candidate in candidates}
        for definition in ROLE_PROMPT_DEFINITIONS:
            content = getattr(document.role_recommendations, definition.key)
            for item in content.items:
                if item.product_name not in allowed:
                    raise ValueError("LLM 使用了輸入資料不存在的品項")
                candidate = candidate_by_product[item.product_name]
                if item.market_name and item.market_name != candidate.get("market_name"):
                    raise ValueError("LLM 使用了輸入資料不存在的市場")
                if item.price_status != candidate.get("status"):
                    raise ValueError("LLM 修改了輸入資料的價格狀態")
                if item.today_price != candidate.get("today_price") or item.recent_average != candidate.get("recent_average"):
                    raise ValueError("LLM 修改了輸入資料的價格")
                if item.substitute and item.substitute not in allowed:
                    raise ValueError("LLM 使用了輸入資料不存在的替代品")

    @staticmethod
    def _document_from_rules(
        category,
        candidates,
        source_summary,
        input_digest,
        region=None,
        market=None,
    ) -> RecommendationDocument:
        cheap = sum(1 for row in candidates if row.get("status") == "便宜")
        normal = sum(1 for row in candidates if row.get("status") == "正常")
        expensive = sum(1 for row in candidates if row.get("status") == "偏貴")
        substitutes = [row for row in candidates if row.get("status") in {"便宜", "正常"}]

        role_contents = {}
        for definition in ROLE_PROMPT_DEFINITIONS:
            items = []
            for row in candidates[:6]:
                action, reason, priority, substitute = RecommendationService._rule_decision(
                    definition.key,
                    row,
                    substitutes,
                )
                status = row.get("status", "資料不足")
                if status not in {"便宜", "正常", "偏貴", "資料不足"}:
                    status = "資料不足"
                items.append(
                    RecommendationItem(
                        product_name=row.get("product_name", ""),
                        market_name=row.get("market_name"),
                        price_status=status,
                        today_price=row.get("today_price"),
                        recent_average=row.get("recent_average"),
                        action=action,
                        reason=reason,
                        priority=priority,
                        substitute=substitute,
                    )
                )

            summary, outlook, strategy = RecommendationService._rule_role_summary(
                definition.key,
                category.label,
                len(candidates),
                cheap,
                normal,
                expensive,
            )
            role_contents[definition.key] = RoleRecommendationContent(
                role=definition.key,
                role_label=definition.label,
                perspective=definition.perspective,
                summary=summary,
                market_outlook=outlook,
                shopping_strategy=strategy,
                items=items,
            )

        return RecommendationDocument(
            cache_key=category.key,
            cache_object_key=cache_key_for(category.key, region, market),
            category=CategoryInfo(**category.as_dict()),
            generated_at=datetime.now(timezone.utc),
            generator="rules-fallback",
            provider=None,
            model=None,
            region=region,
            market=market,
            input_digest=input_digest,
            source_summary=source_summary,
            role_recommendations=RoleRecommendationBundle(**role_contents),
        )

    @staticmethod
    def _rule_decision(role_key: str, row: dict, substitutes: list[dict]) -> tuple[str, str, str, str | None]:
        status = row.get("status", "資料不足")
        substitute = next(
            (
                item["product_name"]
                for item in substitutes
                if item["product_name"] != row.get("product_name")
            ),
            None,
        )

        if role_key == "consumer":
            if status == "便宜":
                return "優先採買", "今日價格低於近期平均，可依家庭需求列入採買清單，避免因便宜而過量囤貨。", "high", None
            if status == "偏貴":
                return "少量購買", "今日價格高於近期平均，建議控制購買量並比較同分類替代品。", "low", substitute
            if status == "正常":
                return "依需求採買", "今日價格接近近期平均，可依家中實際需求購買。", "medium", None
            return "先查最新行情", "近期資料不足，建議確認交易日期與最新市場價格後再購買。", "low", None

        if role_key == "farmer":
            if status == "偏貴":
                return "評估分批出貨", "目前行情高於近期平均，可核對可交付量與自身成本後安排分批出貨，不代表價格會持續。", "high", None
            if status == "便宜":
                return "檢查出貨節奏", "目前行情低於近期平均，應先核對成本、保存條件與既定合約，避免只因單日價格改變生產。", "medium", None
            if status == "正常":
                return "維持既定節奏", "目前行情接近近期平均，可依既定採收與出貨計畫執行並持續觀察。", "medium", None
            return "補查市場資料", "近期資料不足，先確認最新市場行情，再評估採收與出貨安排。", "low", None

        if status == "便宜":
            return "分批補貨", "今日行情低於近期平均，可依實際銷售速度分批補貨，避免一次建立過高庫存。", "high", None
        if status == "偏貴":
            return "控制進貨量", "今日行情高於近期平均，建議降低單次進貨量並比較同分類替代品。", "low", substitute
        if status == "正常":
            return "依銷售速度補貨", "今日行情接近近期平均，可依現有庫存與銷售速度安排補貨。", "medium", None
        return "確認供應報價", "近期資料不足，建議先向供應端確認最新報價與可交付狀況。", "low", None

    @staticmethod
    def _rule_role_summary(
        role_key: str,
        category_label: str,
        candidate_count: int,
        cheap: int,
        normal: int,
        expensive: int,
    ) -> tuple[str, str, str]:
        outlook = "以下僅依目前行情與近期平均提供保守判斷，不代表未來價格、需求或供應保證。"
        if role_key == "consumer":
            summary = f"{category_label}目前有 {candidate_count} 個可比較品項，其中 {cheap} 個相對便宜、{expensive} 個偏貴。"
            strategy = "優先選擇價格便宜或正常的品項；偏貴品項少量購買，必要時比較同分類替代品。"
            return summary, outlook, strategy
        if role_key == "farmer":
            summary = f"{category_label}目前有 {candidate_count} 個行情候選，其中 {expensive} 個高於近期平均、{normal} 個接近近期平均。"
            strategy = "行情偏高時核對可交付量後分批出貨；行情偏低時先檢查成本與既定安排，不依單日價格擴大生產。"
            return summary, outlook, strategy
        summary = f"{category_label}目前有 {candidate_count} 個可供採購比較的品項，其中 {cheap} 個相對便宜、{normal} 個價格正常。"
        strategy = "便宜品項可依銷售速度分批補貨；偏貴品項控制庫存並比較替代品，避免把行情誤當成需求資料。"
        return summary, outlook, strategy
