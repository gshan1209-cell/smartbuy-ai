from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import copy
import json
import threading
import time

import pandas as pd
import pytest

from src.recommendation.cache_repository import CacheCorruptError, CacheWriteError
from src.recommendation.category_catalog import SCHEMA_VERSION, cache_key_for
from src.recommendation.local_recommendation_cache import LocalRecommendationCacheRepository
from src.recommendation.r2_recommendation_cache import R2RecommendationCacheRepository
from src.recommendation.recommendation_service import RecommendationService
from src.recommendation.role_prompts import PROMPT_SET_VERSION, ROLE_KEYS


class FakeCacheRepository:
    backend_name = "r2"

    def __init__(self):
        self.objects: dict[str, dict] = {}
        self.lock = threading.Lock()

    def exists(self, cache_key):
        with self.lock:
            return cache_key in self.objects

    def read(self, cache_key):
        with self.lock:
            return self.objects[cache_key]

    def create_if_absent(self, cache_key, payload):
        with self.lock:
            if cache_key in self.objects:
                return False
            self.objects[cache_key] = payload
            return True


class FailingWriteRepository(FakeCacheRepository):
    def create_if_absent(self, cache_key, payload):
        raise CacheWriteError("write failed")


class CountingLLM:
    provider = "test-provider"
    model = "test-model"

    def __init__(self, failure=False, delay=0):
        self.calls = 0
        self.failure = failure
        self.delay = delay
        self.lock = threading.Lock()
        self.prompts: list[str] = []

    def generate(self, prompt):
        with self.lock:
            self.calls += 1
            self.prompts.append(prompt)
        if self.delay:
            time.sleep(self.delay)
        if self.failure:
            raise RuntimeError("LLM unavailable")

        base = {
            "summary": "可依行情比較並採取角色化行動。",
            "market_outlook": "目前資料僅供保守判斷。",
            "shopping_strategy": "優先依角色目標比較價格狀態。",
            "items": [
                {
                    "product_name": "菠菜",
                    "market_name": "台北一",
                    "price_status": "正常",
                    "today_price": 20,
                    "recent_average": 21,
                    "action": "依角色需求行動",
                    "reason": "今日價格接近近期平均。",
                    "priority": "medium",
                    "substitute": None,
                }
            ],
        }
        role_recommendations = {}
        for role in ROLE_KEYS:
            content = copy.deepcopy(base)
            content["summary"] = f"{role} 角色摘要"
            content["shopping_strategy"] = f"{role} 角色策略"
            content["items"][0]["action"] = f"{role} 行動"
            role_recommendations[role] = content
        return {"role_recommendations": role_recommendations}


class InvalidPriceLLM(CountingLLM):
    def generate(self, prompt):
        payload = super().generate(prompt)
        payload["role_recommendations"]["consumer"]["items"][0]["today_price"] = 999
        return payload


class RoleArrayLLM(CountingLLM):
    def generate(self, prompt):
        payload = super().generate(prompt)
        return [
            {"role": role, **content}
            for role, content in payload["role_recommendations"].items()
        ]


def prices():
    rows = []
    for product, values in {
        "菠菜": [20, 21, 22, 20],
        "高麗菜": [30, 31, 29, 28],
        "香蕉": [35, 36, 34, 35],
    }.items():
        for index, value in enumerate(values):
            rows.append(
                {
                    "product_name": product,
                    "market_name": "台北一",
                    "avg_price": value,
                    "trans_date": pd.Timestamp("2026-07-20") + pd.Timedelta(days=index),
                }
            )
    frame = pd.DataFrame(rows)
    frame.attrs["source"] = "Supabase"
    frame.attrs["is_historical"] = False
    return frame


def market_prices():
    rows = []
    for market, values in {"台北一": [20, 21, 22, 20], "台中一": [35, 36, 34, 35]}.items():
        for index, value in enumerate(values):
            rows.append(
                {
                    "product_name": "菠菜",
                    "market_name": market,
                    "avg_price": value,
                    "trans_date": pd.Timestamp("2026-07-20") + pd.Timedelta(days=index),
                }
            )
    frame = pd.DataFrame(rows)
    frame.attrs["source"] = "Supabase"
    frame.attrs["is_historical"] = False
    return frame


@pytest.fixture(autouse=True)
def clear_price_cache():
    from backend.cache import price_cache

    previous = price_cache.pop("prices", None)
    yield
    if previous is not None:
        price_cache["prices"] = previous


def make_service(repository=None, llm=None):
    return RecommendationService(
        repository or FakeCacheRepository(),
        llm or CountingLLM(),
        price_loader=prices,
    )


def test_missing_json_calls_llm_once_then_hits_cache():
    llm = CountingLLM()
    service = make_service(llm=llm)

    first = service.get_recommendation("leafy-vegetables")
    second = service.get_recommendation("leafy-vegetables")

    assert first.cache_hit is False
    assert first.llm_called is True
    assert second.cache_hit is True
    assert second.llm_called is False
    assert llm.calls == 1
    assert set(first.document.role_recommendations.model_dump()) == set(ROLE_KEYS)


def test_single_prompt_contains_three_distinct_role_prompt_sets():
    llm = CountingLLM()
    service = make_service(llm=llm)

    result = service.get_recommendation("leafy-vegetables")

    assert result.document.prompt_set_version == PROMPT_SET_VERSION
    assert llm.calls == 1
    prompt = json.loads(llm.prompts[0])
    assert set(prompt["role_prompts"]) == set(ROLE_KEYS)
    assert set(prompt["output_schema"]["role_recommendations"]) == set(ROLE_KEYS)
    objectives = {payload["objective"] for payload in prompt["role_prompts"].values()}
    assert len(objectives) == 3


def test_role_array_llm_response_is_normalized_and_validated():
    service = make_service(llm=RoleArrayLLM())

    result = service.get_recommendation("leafy-vegetables")

    assert result.document.generator == "llm"
    assert result.document.provider == "test-provider"
    assert set(result.document.role_recommendations.model_dump()) == set(ROLE_KEYS)


def test_existing_json_never_calls_llm():
    repository = FakeCacheRepository()
    llm = CountingLLM()
    service = make_service(repository=repository, llm=llm)
    service.get_recommendation("leafy-vegetables")
    llm.calls = 0

    result = service.get_recommendation("leafy-vegetables")

    assert result.cache_hit is True
    assert result.llm_called is False
    assert llm.calls == 0


def test_corrupt_json_never_calls_llm():
    repository = FakeCacheRepository()
    repository.objects[cache_key_for("leafy-vegetables")] = {"schema_version": 999}
    llm = CountingLLM()
    service = make_service(repository=repository, llm=llm)

    with pytest.raises(CacheCorruptError):
        service.get_recommendation("leafy-vegetables")

    assert llm.calls == 0


def test_same_category_concurrent_requests_call_llm_once():
    llm = CountingLLM(delay=0.1)
    service = make_service(llm=llm)

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: service.get_recommendation("leafy-vegetables"), range(6)))

    assert llm.calls == 1
    assert sum(result.llm_called for result in results) == 1
    assert sum(result.cache_hit for result in results) == 5


def test_different_categories_use_different_keys():
    repository = FakeCacheRepository()
    service = make_service(repository=repository, llm=CountingLLM())

    service.get_recommendation("leafy-vegetables")
    service.get_recommendation("fruit")

    assert set(repository.objects) == {
        cache_key_for("leafy-vegetables"),
        cache_key_for("fruit"),
    }


def test_cache_key_names_market_and_category():
    assert cache_key_for("leafy-vegetables", market="Taipei Market") == (
        f"v{SCHEMA_VERSION}/taipei-market-leafy-vegetables.json"
    )
    assert cache_key_for("leafy-vegetables", region="north") == (
        f"v{SCHEMA_VERSION}/north-all-markets-leafy-vegetables.json"
    )


def test_market_context_uses_distinct_cache_objects_and_filters_candidates():
    repository = FakeCacheRepository()
    llm = CountingLLM(failure=True)
    service = RecommendationService(repository, llm, price_loader=market_prices)

    north = service.get_recommendation("leafy-vegetables", region="north", market="台北一")
    central = service.get_recommendation("leafy-vegetables", region="central", market="台中一")

    assert llm.calls == 2
    assert north.document.market == "台北一"
    assert central.document.market == "台中一"
    assert north.document.cache_object_key != central.document.cache_object_key
    assert all(item.market_name == "台北一" for item in north.document.role_recommendations.consumer.items)
    assert all(item.market_name == "台中一" for item in central.document.role_recommendations.consumer.items)


def test_region_context_filters_markets_when_market_is_not_selected():
    service = RecommendationService(FakeCacheRepository(), CountingLLM(failure=True), price_loader=market_prices)

    result = service.get_recommendation("leafy-vegetables", region="central")

    assert result.document.region == "central"
    assert result.document.market is None
    assert all(item.market_name == "台中一" for item in result.document.role_recommendations.consumer.items)


def test_unknown_category_is_rejected():
    service = make_service()

    with pytest.raises(ValueError):
        service.get_recommendation("../not-allowed")


def test_llm_failure_writes_three_role_rules_fallback_and_next_request_is_cached():
    llm = CountingLLM(failure=True)
    service = make_service(llm=llm)

    first = service.get_recommendation("leafy-vegetables")
    second = service.get_recommendation("leafy-vegetables")

    assert first.document.generator == "rules-fallback"
    assert first.llm_called is True
    assert second.cache_hit is True
    assert second.llm_called is False
    assert llm.calls == 1
    assert first.document.role_recommendations.consumer.shopping_strategy
    assert first.document.role_recommendations.farmer.shopping_strategy
    assert first.document.role_recommendations.merchant.shopping_strategy


def test_cache_write_failure_is_not_reported_as_success():
    service = make_service(repository=FailingWriteRepository())

    with pytest.raises(CacheWriteError):
        service.get_recommendation("leafy-vegetables")


def test_invalid_llm_price_is_replaced_by_three_role_rules_fallback():
    llm = InvalidPriceLLM()
    service = make_service(llm=llm)

    result = service.get_recommendation("leafy-vegetables")

    assert result.document.generator == "rules-fallback"
    assert llm.calls == 1
    assert result.document.role_recommendations.consumer.items[0].today_price != 999


def test_response_keeps_consumer_alias_for_backward_compatibility():
    response = make_service().get_recommendation("leafy-vegetables").as_response()

    assert response["data"]["recommendation"] == response["role_recommendations"]["consumer"]
    assert response["recommendations"] == response["role_recommendations"]["consumer"]["items"]


def test_local_repository_uses_create_only_and_detects_corrupt_json(tmp_path):
    repository = LocalRecommendationCacheRepository(tmp_path)
    key = cache_key_for("leafy-vegetables")
    payload = {"schema_version": SCHEMA_VERSION}

    assert repository.create_if_absent(key, payload) is True
    assert repository.create_if_absent(key, {"schema_version": SCHEMA_VERSION + 1}) is False
    assert repository.read(key) == payload

    repository._path(cache_key_for("fruit")).parent.mkdir(parents=True, exist_ok=True)
    repository._path(cache_key_for("fruit")).write_text("{broken", encoding="utf-8")
    with pytest.raises(CacheCorruptError):
        repository.read(cache_key_for("fruit"))


def test_r2_repository_routes_legacy_configured_prefix_to_current_schema_version():
    repository = R2RecommendationCacheRepository(
        client=object(),
        bucket_name="test-bucket",
        prefix="recommendations/v1/",
    )

    assert repository.object_key(cache_key_for("leafy-vegetables")) == (
        f"recommendations/v{SCHEMA_VERSION}/{cache_key_for('leafy-vegetables').split('/', 1)[1]}"
    )
