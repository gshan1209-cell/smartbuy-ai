"""Cloudflare R2 的推薦 JSON 持久快取實作。"""
from __future__ import annotations

import json
import os

from botocore.exceptions import ClientError

from src.data.r2_sync import _get_r2_client, get_r2_config
from .cache_repository import CacheBackendError, CacheCorruptError, CacheNotFoundError, CacheWriteError
from .category_catalog import SCHEMA_VERSION


class R2RecommendationCacheRepository:
    backend_name = "r2"

    def __init__(self, client=None, bucket_name: str | None = None, prefix: str | None = None):
        config = get_r2_config()
        configured_prefix = prefix or os.getenv(
            "R2_RECOMMENDATION_PREFIX",
            f"recommendations/v{SCHEMA_VERSION}/",
        )
        self.bucket_name = bucket_name or config["bucket_name"]
        self.prefix = self._normalize_versioned_prefix(configured_prefix)
        self.client = client or _get_r2_client()
        if not self.bucket_name:
            raise ValueError("R2_BUCKET_NAME 未設定")

    @staticmethod
    def _normalize_versioned_prefix(prefix: str) -> str:
        """Keep custom base prefixes while routing the active schema to its own version."""
        normalized = prefix.strip("/")
        if not normalized:
            return f"v{SCHEMA_VERSION}"
        parts = normalized.split("/")
        tail = parts[-1]
        if tail.startswith("v") and tail[1:].isdigit():
            parts[-1] = f"v{SCHEMA_VERSION}"
        return "/".join(parts)

    def object_key(self, cache_key: str) -> str:
        if not cache_key.startswith("v") or "/" not in cache_key:
            raise ValueError("無效的推薦快取鍵")
        version_prefix = f"v{SCHEMA_VERSION}"
        relative_key = cache_key.split("/", 1)[1] if cache_key.startswith(f"{version_prefix}/") else cache_key
        if self.prefix.endswith(version_prefix):
            return f"{self.prefix}/{relative_key}"
        return f"{self.prefix}/{cache_key}" if self.prefix else cache_key

    @staticmethod
    def _is_not_found(error: ClientError) -> bool:
        response = getattr(error, "response", {})
        code = str(response.get("Error", {}).get("Code", ""))
        return response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404 or code in {"404", "NoSuchKey", "NotFound"}

    def exists(self, cache_key: str) -> bool:
        key = self.object_key(cache_key)
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except ClientError as exc:
            if self._is_not_found(exc):
                return False
            raise CacheBackendError(f"R2 head 讀取失敗: {key}") from exc
        except Exception as exc:
            raise CacheBackendError(f"R2 head 讀取失敗: {key}") from exc

    def read(self, cache_key: str) -> dict:
        key = self.object_key(cache_key)
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            raw = response["Body"].read()
        except ClientError as exc:
            if self._is_not_found(exc):
                raise CacheNotFoundError(cache_key) from exc
            raise CacheBackendError(f"R2 object 讀取失敗: {key}") from exc
        except Exception as exc:
            raise CacheBackendError(f"R2 object 讀取失敗: {key}") from exc
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CacheCorruptError(f"R2 JSON 損壞: {key}") from exc
        if not isinstance(payload, dict):
            raise CacheCorruptError(f"R2 JSON 必須是 object: {key}")
        return payload

    def create_if_absent(self, cache_key: str, payload: dict) -> bool:
        key = self.object_key(cache_key)
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
                ContentType="application/json; charset=utf-8",
                IfNoneMatch="*",
            )
            return True
        except ClientError as exc:
            response = getattr(exc, "response", {})
            code = str(response.get("Error", {}).get("Code", ""))
            status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if status == 412 or code in {"PreconditionFailed", "412"}:
                return False
            raise CacheWriteError(f"R2 object 寫入失敗: {key}") from exc
        except Exception as exc:
            raise CacheWriteError(f"R2 object 寫入失敗: {key}") from exc
