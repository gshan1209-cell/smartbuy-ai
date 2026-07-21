from __future__ import annotations
import time
from typing import Any
from fastapi import APIRouter, Query, HTTPException

from src.calendar.solar_terms import get_current_solar_term
from src.data.agri_news_repository import query_agri_news, query_agri_news_count, query_news_sources

_news_cache: dict[str, Any] = {}
_NEWS_TTL = 300  # 5 分鐘


def _news_cache_key(source_name, keyword, limit, offset) -> str:
    return f"{source_name}|{keyword}|{limit}|{offset}"


def _get_cached_news(key: str):
    entry = _news_cache.get(key)
    if entry and time.time() - entry["ts"] < _NEWS_TTL:
        return entry["data"]
    return None


def _set_cached_news(key: str, data):
    _news_cache[key] = {"data": data, "ts": time.time()}


router = APIRouter()


@router.get("/api/news")
def get_agri_news(
    source: str | None = Query(default=None, max_length=100),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        source_name = source.strip() if source and source.strip() else None
        cache_key = _news_cache_key(source_name, q, limit, offset)
        cached = _get_cached_news(cache_key)
        if cached:
            return cached

        rows = query_agri_news(
            source_name=source_name,
            keyword=q,
            limit=limit,
            offset=offset,
        )
        total = query_agri_news_count(
            source_name=source_name,
            keyword=q,
        )
        response_fields = [
            "id",
            "article_key",
            "source_name",
            "source_article_id",
            "title",
            "published_date",
            "source_url",
            "content_text",
            "updated_at",
        ]
        result = {
            "total": total,
            "limit": limit,
            "offset": offset,
            "articles": [{key: row.get(key) for key in response_fields} for row in rows],
        }
        _set_cached_news(cache_key, result)
        return result
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="新聞資料暫時無法取得，請稍後再試。",
        )


@router.get("/api/news/sources")
def get_news_sources():
    try:
        sources = query_news_sources()
        return {"sources": sources}
    except RuntimeError:
        raise HTTPException(status_code=503, detail="來源資料暫時無法取得。")


@router.get("/api/solar-term")
def solar_term():
    return get_current_solar_term()
