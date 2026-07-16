"""
Read-only repository for public agriculture news articles.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from src.data.database_url import load_database_url


_engine: Engine | None = None
_engine_database_url: str | None = None


def _get_engine() -> Engine:
    global _engine, _engine_database_url

    database_url = load_database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set.")

    if _engine is None or database_url != _engine_database_url:
        if _engine is not None:
            _engine.dispose()
        _engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=3,
            max_overflow=2,
        )
        _engine_database_url = database_url

    return _engine


def _build_query(
    *,
    source_name: str | None,
    keyword: str | None,
) -> tuple[Any, dict[str, Any]]:
    sql = """
        SELECT
            id,
            article_key,
            source_name,
            source_article_id,
            title,
            published_date,
            source_url,
            content_text,
            updated_at
        FROM public.agri_news_articles
        WHERE parse_status = 'success'
          AND content_text IS NOT NULL
          AND BTRIM(content_text) <> ''
    """
    params: dict[str, Any] = {}

    if source_name:
        sql += " AND source_name = :source_name"
        params["source_name"] = source_name

    if keyword:
        sql += " AND (title ILIKE :keyword OR content_text ILIKE :keyword)"
        params["keyword"] = f"%{keyword}%"

    sql += """
        ORDER BY published_date DESC NULLS LAST, id DESC
        LIMIT :limit
        OFFSET :offset;
    """

    return text(sql), params


def _row_to_dict(row: Any) -> dict[str, Any]:
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    return dict(row)


def query_news_sources() -> list[str]:
    try:
        sql = text("""
            SELECT DISTINCT source_name
            FROM public.agri_news_articles
            WHERE source_name IS NOT NULL
            ORDER BY source_name ASC
        """)
        engine = _get_engine()
        with engine.connect() as conn:
            rows = conn.execute(sql).fetchall()
        return [row[0] for row in rows]
    except Exception as exc:
        raise RuntimeError("Unable to query news sources.") from exc


def query_agri_news_count(
    source_name: str | None = None,
    keyword: str | None = None,
) -> int:
    """
    Return the total count of rows matching the same filters as query_agri_news.
    """
    try:
        sql = """
            SELECT COUNT(*)
            FROM public.agri_news_articles
            WHERE parse_status = 'success'
              AND content_text IS NOT NULL
              AND BTRIM(content_text) <> ''
        """
        params: dict[str, Any] = {}

        if source_name:
            sql += " AND source_name = :source_name"
            params["source_name"] = source_name

        if keyword:
            sql += " AND (title ILIKE :keyword OR content_text ILIKE :keyword)"
            params["keyword"] = f"%{keyword}%"

        engine = _get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql), params)
            return result.scalar() or 0
    except Exception as exc:
        raise RuntimeError("Unable to count agriculture news.") from exc


def query_agri_news(
    source_name: str | None = None,
    keyword: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Query successfully parsed agriculture news with non-empty content.
    """
    try:
        statement, params = _build_query(source_name=source_name, keyword=keyword)
        params["limit"] = limit
        params["offset"] = offset

        engine = _get_engine()
        with engine.connect() as conn:
            rows = conn.execute(statement, params).mappings().all()
        return [_row_to_dict(row) for row in rows]
    except Exception as exc:
        raise RuntimeError("Unable to query agriculture news.") from exc
