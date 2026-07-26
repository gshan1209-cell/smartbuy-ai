"""AI 採買推薦的快取優先、single-flight 與規則備援流程。"""
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

from backend.cache import price_cache
from src.anomaly.price_status import get_all_price_statuses
from src.data.price_repository import load_price_history

from .cache_repository import (
    CacheBackendError,
    CacheCorruptError,
    CacheWriteError,
    RecommendationCacheRepository,
    build_recommendation_cache_repository,
)
from .category_catalog import CategoryDefinition, cache_key_for, get_category
from .llm_recommendation_client import (
    OpenAICompatibleRecommendationClient,
    RecommendationLLMClient,
)
from .recommendation_models import (
    CategoryInfo,
    RecommendationContent,
    RecommendationDocument,
    RecommendationItem,
    SourceSummary,
)


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
        return {
            "category": self.document.category.key,
            "cache_hit": self.cache_hit,
            "llm_called": self.llm_called,
            "cache_backend": self.cache_backend,
            "generation_source": "rule_fallback" if self.document.generator == "rules-fallback" else "llm",
            "generated_at": data["generated_at"],
            "data_status": self.document.source_summary.data_status,
            "source_name": self.document.source_summary.source_name,
            "data": data,
            "recommendations": data["recommendation"]["items"],
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

    def get_recommendation(self, category_key: str) -> RecommendationResult:
        started = time.perf_counter()
        category = get_category(category_key)
        cache_key = cache_key_for(category.key)

        cached = self._read_existing(category, cache_key)
        if cached is not None:
            self._log_result(category, cache_key, cached, cache_hit=True, llm_called=False, started=started)
            return RecommendationResult(cached, cache_hit=True, llm_called=False, cache_backend=self.repository.backend_name)

        entry = self._acquire_lock(cache_key)
        try:
            cached = self._read_existing(category, cache_key)
            if cached is not None:
                self._log_result(category, cache_key, cached, cache_hit=True, llm_called=False, started=started)
                return RecommendationResult(cached, cache_hit=True, llm_called=False, cache_backend=self.repository.backend_name)

            candidates, source_summary = self._load_candidates(category)
            if not candidates:
                raise RecommendationDataUnavailable(f"分類沒有可用行情候選品項: {category.key}")

            input_digest = self._input_digest(category, candidates, source_summary)
            prompt = self._build_prompt(category, candidates, source_summary)
            llm_called = True
            try:
                raw = self.llm_client.generate(prompt)
                document = self._document_from_llm(
                    category,
                    raw,
                    candidates,
                    source_summary,
                    input_digest,
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
            persisted = self._read_existing(category, cache_key)
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
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                "error_type": None,
            },
        )

    def _read_existing(self, category: CategoryDefinition, cache_key: str) -> RecommendationDocument | None:
        try:
            if not self.repository.exists(cache_key):
                return None
            raw = self.repository.read(cache_key)
            document = RecommendationDocument.model_validate(raw)
            if document.cache_key != category.key or document.category.key != category.key:
                raise CacheCorruptError(f"推薦快取分類不一致: {cache_key}")
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

    def _load_candidates(self, category: CategoryDefinition) -> tuple[list[dict], SourceSummary]:
        try:
            prices = price_cache.get("prices")
            if prices is None:
                prices = self.price_loader()
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
        if filtered.empty:
            return [], self._source_summary(data, 0)

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
    def _input_digest(category: CategoryDefinition, candidates: list[dict], source_summary: SourceSummary) -> str:
        raw = json.dumps(
            {"category": category.key, "candidates": candidates, "source_summary": source_summary.model_dump()},
            sort_keys=True,
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:16]

    @staticmethod
    def _build_prompt(category: CategoryDefinition, candidates: list[dict], source_summary: SourceSummary) -> str:
        return json.dumps(
            {
                "task": "提供保守、可執行的採買建議，只能使用 candidates 中的品項與價格。",
                "category": category.as_dict(),
                "source_summary": source_summary.model_dump(),
                "candidates": candidates,
                "output_schema": {
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
                },
                "rules": [
                    "只輸出 JSON object，不要 Markdown。",
                    "最多 6 個 items，只能選 candidates 已存在的品項。",
                    "不得虛構價格、產地、營養、食安或供應資訊。",
                    "不得做保證性價格預測或醫療建議。",
                ],
            },
            ensure_ascii=False,
        )

    def _document_from_llm(self, category, raw, candidates, source_summary, input_digest) -> RecommendationDocument:
        if "recommendation" in raw:
            recommendation = raw["recommendation"]
        else:
            recommendation = raw
        if not isinstance(recommendation, dict):
            raise ValueError("LLM recommendation 不是 object")
        payload = {
            "schema_version": 1,
            "cache_key": category.key,
            "category": category.as_dict(),
            "generated_at": datetime.now(timezone.utc),
            "generator": "llm",
            "provider": getattr(self.llm_client, "provider", "openai-compatible"),
            "model": getattr(self.llm_client, "model", None),
            "input_digest": input_digest,
            "source_summary": source_summary.model_dump(),
            "recommendation": recommendation,
        }
        document = RecommendationDocument.model_validate(payload)
        allowed = {candidate["product_name"] for candidate in candidates}
        if any(item.product_name not in allowed for item in document.recommendation.items):
            raise ValueError("LLM 使用了輸入資料不存在的品項")
        for item in document.recommendation.items:
            candidate = next(row for row in candidates if row["product_name"] == item.product_name)
            if item.market_name and item.market_name != candidate.get("market_name"):
                raise ValueError("LLM 使用了輸入資料不存在的市場")
            if item.price_status != candidate.get("status"):
                raise ValueError("LLM 修改了輸入資料的價格狀態")
            if item.today_price != candidate.get("today_price") or item.recent_average != candidate.get("recent_average"):
                raise ValueError("LLM 修改了輸入資料的價格")
            if item.substitute and item.substitute not in allowed:
                raise ValueError("LLM 使用了輸入資料不存在的替代品")
        return document

    @staticmethod
    def _document_from_rules(category, candidates, source_summary, input_digest) -> RecommendationDocument:
        rank = {"便宜": 0, "正常": 1, "偏貴": 2, "資料不足": 3}
        substitutes = [row for row in candidates if row.get("status") in {"便宜", "正常"}]
        items = []
        for row in candidates[:6]:
            status = row.get("status", "資料不足")
            if status == "便宜":
                action, reason, priority = "優先採買", "今日價格低於近期平均，可列入採買清單。", "high"
            elif status == "偏貴":
                action, reason, priority = "少量購買", "今日價格高於近期平均，建議比較同類品項。", "low"
            elif status == "正常":
                action, reason, priority = "依需求採買", "今日價格接近近期平均，可依實際需求購買。", "medium"
            else:
                action, reason, priority = "留意資料", "近期資料不足，建議先確認最新行情。", "low"
            substitute = next((item["product_name"] for item in substitutes if item["product_name"] != row.get("product_name")), None) if status == "偏貴" else None
            items.append(
                RecommendationItem(
                    product_name=row.get("product_name", ""),
                    market_name=row.get("market_name"),
                    price_status=status if status in rank else "資料不足",
                    today_price=row.get("today_price"),
                    recent_average=row.get("recent_average"),
                    action=action,
                    reason=reason,
                    priority=priority,
                    substitute=substitute,
                )
            )
        cheap = sum(1 for row in candidates if row.get("status") == "便宜")
        expensive = sum(1 for row in candidates if row.get("status") == "偏貴")
        summary = f"{category.label}目前有 {len(candidates)} 個可比較品項，其中 {cheap} 個價格相對划算。"
        outlook = "依目前行情資料提供保守判斷；價格狀態不代表未來價格保證。"
        strategy = "優先比較價格便宜或正常的品項；偏貴品項可少量購買並留意替代選擇。"
        if not cheap and not expensive:
            strategy = "目前沒有明顯便宜或偏貴品項，建議依需求採買並留意交易日期。"
        return RecommendationDocument(
            cache_key=category.key,
            category=CategoryInfo(**category.as_dict()),
            generated_at=datetime.now(timezone.utc),
            generator="rules-fallback",
            provider=None,
            model=None,
            input_digest=input_digest,
            source_summary=source_summary,
            recommendation=RecommendationContent(
                summary=summary,
                market_outlook=outlook,
                shopping_strategy=strategy,
                items=items,
            ),
        )
