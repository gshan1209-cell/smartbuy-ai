from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import threading

import pytest

from backend.routers.recommendations import recommendation_for_category
from src.recommendation.cache_repository import build_recommendation_cache_repository
from src.recommendation.distributed_lock import (
    NoopRecommendationGenerationLock,
    PostgresRecommendationGenerationLock,
    build_recommendation_generation_lock,
)
from src.recommendation.local_recommendation_cache import LocalRecommendationCacheRepository
from src.recommendation.recommendation_service import RecommendationService

from test_recommendation_cache import CountingLLM, FakeCacheRepository, prices


class SharedGenerationLock:
    """模擬多個 app instance 共用的分散式分類鎖。"""

    def __init__(self):
        self._guard = threading.Lock()
        self._locks: dict[str, threading.Lock] = {}

    @contextmanager
    def hold(self, cache_key: str):
        with self._guard:
            lock = self._locks.setdefault(cache_key, threading.Lock())
        with lock:
            yield


def test_two_service_instances_call_llm_only_once_for_same_category():
    repository = FakeCacheRepository()
    llm = CountingLLM(delay=0.1)
    services = [
        RecommendationService(repository, llm, price_loader=prices),
        RecommendationService(repository, llm, price_loader=prices),
    ]
    generation_lock = SharedGenerationLock()

    def request(service):
        return recommendation_for_category(
            category="leafy-vegetables",
            service=service,
            generation_lock=generation_lock,
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(request, services))

    assert llm.calls == 1
    assert sum(bool(result["llm_called"]) for result in results) == 1
    assert sum(bool(result["cache_hit"]) for result in results) == 1


def test_non_r2_repository_does_not_require_postgres_lock(tmp_path):
    repository = LocalRecommendationCacheRepository(tmp_path)

    lock = build_recommendation_generation_lock(repository)

    assert isinstance(lock, NoopRecommendationGenerationLock)


def test_postgres_lock_ids_are_stable_and_category_specific():
    leafy = PostgresRecommendationGenerationLock.lock_id("leafy-vegetables")

    assert leafy == PostgresRecommendationGenerationLock.lock_id("leafy-vegetables")
    assert leafy != PostgresRecommendationGenerationLock.lock_id("fruit")
    assert -(2**63) <= leafy < 2**63


def test_render_never_silently_falls_back_to_local_cache(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("RECOMMENDATION_CACHE_BACKEND", "auto")
    monkeypatch.delenv("R2_REQUIRED", raising=False)
    for name in (
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "R2_ENDPOINT_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(ValueError, match="必須使用已設定的 Cloudflare R2"):
        build_recommendation_cache_repository()


def test_render_rejects_explicit_local_cache(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("RECOMMENDATION_CACHE_BACKEND", "local")

    with pytest.raises(ValueError, match="不可將推薦快取設定為 local"):
        build_recommendation_cache_repository()
