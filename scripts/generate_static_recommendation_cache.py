"""補齊 v5 Git 靜態推薦快取的市場／分類組合。

只建立目前不存在的快取物件，使用本機行情與三角色規則 fallback；
不呼叫 LLM、不覆寫既有快取，也不寫入正式 R2。
"""
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.cache import price_cache
from src.data.data_loader import load_market_prices
from src.recommendation.category_catalog import (
    CATEGORY_CATALOG,
    REGION_MARKET_KEYWORDS,
    cache_key_for,
    market_matches_region,
)
from src.recommendation.local_recommendation_cache import LocalRecommendationCacheRepository
from src.recommendation.recommendation_service import RecommendationService


class _NoopLlm:
    def generate(self, _prompt: str) -> dict:  # pragma: no cover - never called
        raise AssertionError("static cache generation must not call LLM")


def region_for_market(market: str) -> str | None:
    for region in REGION_MARKET_KEYWORDS:
        if market_matches_region(market, region):
            return region
    return None


def main() -> None:
    prices = load_market_prices()
    prices.attrs["source"] = "本機 CSV"
    price_cache["prices"] = prices

    repository = LocalRecommendationCacheRepository()
    service = RecommendationService(repository=repository, llm_client=_NoopLlm())
    markets = sorted(str(value) for value in prices["market_name"].dropna().unique())

    created = 0
    skipped = 0
    empty = 0
    for market in markets:
        region = region_for_market(market)
        for category in CATEGORY_CATALOG:
            cache_key = cache_key_for(category.key, region=region, market=market)
            if repository.exists(cache_key):
                skipped += 1
                continue

            candidates, source_summary = service._load_candidates(
                category,
                region=region,
                market=market,
            )
            if not candidates:
                empty += 1
            input_digest = service._input_digest(
                category,
                candidates,
                source_summary,
                region=region,
                market=market,
            )
            document = service._document_from_rules(
                category,
                candidates,
                source_summary,
                input_digest,
                region=region,
                market=market,
            )
            if repository.create_if_absent(cache_key, document.model_dump(mode="json")):
                created += 1

    print(
        f"markets={len(markets)} categories={len(CATEGORY_CATALOG)} "
        f"created={created} skipped={skipped} empty_candidate_sets={empty}"
    )


if __name__ == "__main__":
    main()
