"""跨執行個體的推薦生成鎖。

正式 R2 模式使用 PostgreSQL advisory lock，確保不同 Render instance
針對同一分類不會同時呼叫 LLM；本機 JSON 模式仍使用 Service 內既有鎖。
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
import hashlib
import logging
import os
import time
from typing import Protocol

from sqlalchemy import text

from src.data.price_repository import get_db_engine


logger = logging.getLogger(__name__)


class RecommendationGenerationLockTimeout(RuntimeError):
    """等待其他執行個體完成同分類推薦時超時。"""


class RecommendationGenerationLock(Protocol):
    @contextmanager
    def hold(self, cache_key: str) -> Iterator[None]: ...


class NoopRecommendationGenerationLock:
    """本機／測試模式使用；同 process 去重由 RecommendationService 負責。"""

    @contextmanager
    def hold(self, cache_key: str) -> Iterator[None]:
        yield


class PostgresRecommendationGenerationLock:
    """使用 session-level PostgreSQL advisory lock 跨 instance 序列化生成。"""

    def __init__(
        self,
        engine=None,
        timeout_seconds: float | None = None,
        poll_interval_seconds: float = 0.25,
    ):
        self.engine = engine or get_db_engine()
        if self.engine is None:
            raise ValueError("正式 AI 推薦需要 DATABASE_URL 以建立跨 instance 分類鎖")
        configured_timeout = timeout_seconds or float(
            os.getenv("RECOMMENDATION_LOCK_TIMEOUT_SECONDS", "150")
        )
        self.timeout_seconds = max(1.0, min(configured_timeout, 300.0))
        self.poll_interval_seconds = max(0.05, min(poll_interval_seconds, 2.0))

    @staticmethod
    def lock_id(cache_key: str) -> int:
        digest = hashlib.sha256(f"smartbuy-recommendation:{cache_key}".encode("utf-8")).digest()
        return int.from_bytes(digest[:8], byteorder="big", signed=True)

    @contextmanager
    def hold(self, cache_key: str) -> Iterator[None]:
        lock_id = self.lock_id(cache_key)
        deadline = time.monotonic() + self.timeout_seconds
        acquired = False

        with self.engine.connect() as connection:
            while not acquired:
                acquired = bool(
                    connection.execute(
                        text("SELECT pg_try_advisory_lock(:lock_id)"),
                        {"lock_id": lock_id},
                    ).scalar()
                )
                if acquired:
                    break
                if time.monotonic() >= deadline:
                    raise RecommendationGenerationLockTimeout(
                        f"等待同分類推薦生成超時: {cache_key}"
                    )
                time.sleep(self.poll_interval_seconds)

            try:
                yield
            finally:
                if acquired:
                    try:
                        connection.execute(
                            text("SELECT pg_advisory_unlock(:lock_id)"),
                            {"lock_id": lock_id},
                        )
                    except Exception:
                        logger.exception(
                            "recommendation_generation_lock_release_failed",
                            extra={"cache_key": cache_key, "lock_id": lock_id},
                        )


def build_recommendation_generation_lock(repository) -> RecommendationGenerationLock:
    """只有正式 R2 Repository 需要跨 instance 鎖；Fake／local 不連資料庫。"""
    from .r2_recommendation_cache import R2RecommendationCacheRepository

    if isinstance(repository, R2RecommendationCacheRepository):
        return PostgresRecommendationGenerationLock()
    return NoopRecommendationGenerationLock()
