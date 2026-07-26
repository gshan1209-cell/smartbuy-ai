"""推薦 JSON 快取的 Repository 介面與正式環境選擇器。"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

from src.data.r2_sync import is_r2_configured


class RecommendationCacheError(RuntimeError):
    """Base error for cache access failures."""


class CacheNotFoundError(RecommendationCacheError):
    """The requested cache object does not exist."""


class CacheCorruptError(RecommendationCacheError):
    """The object exists but is not valid JSON."""


class CacheBackendError(RecommendationCacheError):
    """The cache backend could not be read."""


class CacheWriteError(RecommendationCacheError):
    """The cache backend rejected a write."""


class RecommendationCacheRepository(Protocol):
    backend_name: str

    def exists(self, cache_key: str) -> bool: ...

    def read(self, cache_key: str) -> dict: ...

    def create_if_absent(self, cache_key: str, payload: dict) -> bool: ...


def build_recommendation_cache_repository():
    """Choose durable R2 in configured/strict environments, local only for dev/test."""
    backend = os.getenv("RECOMMENDATION_CACHE_BACKEND", "auto").strip().lower()
    strict = os.getenv("R2_REQUIRED") == "true" or os.getenv("GITHUB_ACTIONS") == "true"

    if backend not in {"auto", "r2", "local"}:
        raise ValueError("RECOMMENDATION_CACHE_BACKEND 只能是 auto、r2 或 local")
    if strict and backend == "local":
        raise ValueError("正式環境不可將推薦快取設定為 local")
    if backend == "r2" or (backend == "auto" and is_r2_configured()):
        if not is_r2_configured():
            raise ValueError("推薦功能需要完整的 Cloudflare R2 設定")
        from .r2_recommendation_cache import R2RecommendationCacheRepository

        return R2RecommendationCacheRepository()
    if strict:
        raise ValueError("正式環境推薦快取必須使用已設定的 Cloudflare R2")

    from .local_recommendation_cache import LocalRecommendationCacheRepository

    return LocalRecommendationCacheRepository()
