"""供本機開發與測試使用的 JSON 檔案快取。"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .cache_repository import CacheBackendError, CacheCorruptError, CacheWriteError


_SAFE_CACHE_KEY = re.compile(r"^v[0-9]+/[a-z0-9-]+\.json$")


class LocalRecommendationCacheRepository:
    backend_name = "local"

    def __init__(self, root: str | Path | None = None):
        project_root = Path(__file__).resolve().parents[2]
        self.root = Path(root or os.getenv("RECOMMENDATION_LOCAL_CACHE_DIR", project_root / ".cache" / "recommendations"))
        self.root = self.root.resolve()

    def _path(self, cache_key: str) -> Path:
        if not _SAFE_CACHE_KEY.fullmatch(cache_key):
            raise ValueError("無效的推薦快取鍵")
        path = (self.root / cache_key).resolve()
        try:
            path.relative_to(self.root)
        except ValueError as exc:
            raise ValueError("推薦快取鍵超出允許目錄") from exc
        return path

    def exists(self, cache_key: str) -> bool:
        return self._path(cache_key).is_file()

    def read(self, cache_key: str) -> dict:
        path = self._path(cache_key)
        if not path.is_file():
            from .cache_repository import CacheNotFoundError

            raise CacheNotFoundError(cache_key)
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CacheCorruptError(f"推薦快取 JSON 損壞: {cache_key}") from exc
        except OSError as exc:
            raise CacheBackendError(f"無法讀取推薦快取: {cache_key}") from exc
        if not isinstance(payload, dict):
            raise CacheCorruptError(f"推薦快取必須是 JSON object: {cache_key}")
        return payload

    def create_if_absent(self, cache_key: str, payload: dict) -> bool:
        path = self._path(cache_key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("x", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            return True
        except FileExistsError:
            return False
        except OSError as exc:
            raise CacheWriteError(f"無法建立推薦快取: {cache_key}") from exc
