"""
Fetch agriculture news articles and upsert them into Supabase.
"""

from __future__ import annotations

from datetime import date
import os
from pathlib import Path
import sys
from typing import Any

from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from src.data.fetch_agri_news import fetch_agri_news  # noqa: E402


JOB_NAME = "update_agri_news_daily"
VALID_SOURCES = {"農業部", "農糧署"}
VALID_PARSE_STATUSES = {"success", "partial", "failed"}
MATERIAL_FIELDS = [
    "source_name",
    "source_article_id",
    "title",
    "published_date",
    "source_url",
    "content_text",
    "content_hash",
    "parse_status",
    "parse_error",
]


def load_database_url() -> str:
    env_database_url = os.getenv("DATABASE_URL")
    if not env_database_url:
        raise RuntimeError("DATABASE_URL is not set; Supabase connection is required.")
    return "".join(env_database_url.splitlines()).strip().strip('"').strip("'")


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def _normalize_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def validate_article(article: dict[str, Any]) -> dict[str, Any]:
    required = ["article_key", "source_name", "title", "source_url", "parse_status"]
    missing = [key for key in required if not _normalize_text(article.get(key))]
    if missing:
        raise ValueError(f"article missing required fields: {', '.join(missing)}")

    source_name = str(article["source_name"]).strip()
    parse_status = str(article["parse_status"]).strip()

    if source_name not in VALID_SOURCES:
        raise ValueError(f"invalid source_name: {source_name}")

    if parse_status not in VALID_PARSE_STATUSES:
        raise ValueError(f"invalid parse_status: {parse_status}")

    content_text = _normalize_text(article.get("content_text"))
    content_hash = _normalize_text(article.get("content_hash"))
    if not content_text:
        content_hash = None

    if content_hash is not None and len(content_hash) != 64:
        raise ValueError("content_hash must be 64 characters when present")

    return {
        "article_key": str(article["article_key"]).strip(),
        "source_name": source_name,
        "source_article_id": _normalize_text(article.get("source_article_id")),
        "title": str(article["title"]).strip(),
        "published_date": _normalize_date(article.get("published_date")),
        "source_url": str(article["source_url"]).strip(),
        "content_text": content_text,
        "content_hash": content_hash,
        "parse_status": parse_status,
        "parse_error": _normalize_text(article.get("parse_error")),
    }


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    return dict(row)


def _existing_for_compare(existing: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(existing)
    normalized["published_date"] = _normalize_date(normalized.get("published_date"))
    normalized["content_text"] = _normalize_text(normalized.get("content_text"))
    normalized["content_hash"] = _normalize_text(normalized.get("content_hash"))
    normalized["parse_error"] = _normalize_text(normalized.get("parse_error"))
    normalized["source_article_id"] = _normalize_text(normalized.get("source_article_id"))
    return normalized


def _preserve_existing_success_content(
    article: dict[str, Any],
    existing: dict[str, Any],
) -> dict[str, Any]:
    effective = dict(article)
    existing_content = _normalize_text(existing.get("content_text"))
    existing_hash = _normalize_text(existing.get("content_hash"))

    if existing_content and existing_hash and (
        article["parse_status"] == "failed" or not article.get("content_text")
    ):
        effective["content_text"] = existing_content
        effective["content_hash"] = existing_hash

        if existing.get("parse_status") == "success":
            effective["parse_status"] = "success"
            effective["parse_error"] = _normalize_text(existing.get("parse_error"))

    return effective


def _has_material_change(article: dict[str, Any], existing: dict[str, Any]) -> bool:
    normalized_existing = _existing_for_compare(existing)
    return any(article.get(field) != normalized_existing.get(field) for field in MATERIAL_FIELDS)


def write_log(
    conn: Any,
    *,
    status: str,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    error_message: str | None = None,
) -> None:
    conn.execute(
        text(
            """
            INSERT INTO public.data_update_logs (
                job_name,
                status,
                rows_inserted,
                rows_updated,
                error_message
            )
            VALUES (
                :job_name,
                :status,
                :rows_inserted,
                :rows_updated,
                :error_message
            );
            """
        ),
        {
            "job_name": JOB_NAME,
            "status": status,
            "rows_inserted": rows_inserted,
            "rows_updated": rows_updated,
            "error_message": error_message,
        },
    )


SELECT_EXISTING_SQL = text(
    """
    SELECT
        id,
        article_key,
        source_name,
        source_article_id,
        title,
        published_date,
        source_url,
        content_text,
        content_hash,
        parse_status,
        parse_error,
        first_fetched_at
    FROM public.agri_news_articles
    WHERE article_key = :article_key
    LIMIT 1;
    """
)

INSERT_ARTICLE_SQL = text(
    """
    INSERT INTO public.agri_news_articles (
        article_key,
        source_name,
        source_article_id,
        title,
        published_date,
        source_url,
        content_text,
        content_hash,
        parse_status,
        parse_error
    )
    VALUES (
        :article_key,
        :source_name,
        :source_article_id,
        :title,
        :published_date,
        :source_url,
        :content_text,
        :content_hash,
        :parse_status,
        :parse_error
    );
    """
)

UPDATE_ARTICLE_SQL = text(
    """
    UPDATE public.agri_news_articles
    SET
        source_name = :source_name,
        source_article_id = :source_article_id,
        title = :title,
        published_date = :published_date,
        source_url = :source_url,
        content_text = :content_text,
        content_hash = :content_hash,
        parse_status = :parse_status,
        parse_error = :parse_error,
        last_fetched_at = NOW(),
        updated_at = NOW()
    WHERE article_key = :article_key;
    """
)

TOUCH_ARTICLE_SQL = text(
    """
    UPDATE public.agri_news_articles
    SET last_fetched_at = NOW()
    WHERE article_key = :article_key;
    """
)


def upsert_articles(conn: Any, articles: list[dict[str, Any]]) -> dict[str, int]:
    stats = {
        "rows_inserted": 0,
        "rows_updated": 0,
        "rows_unchanged": 0,
        "parse_issue_count": 0,
    }

    for raw_article in articles:
        article = validate_article(raw_article)
        if article["parse_status"] != "success":
            stats["parse_issue_count"] += 1

        existing = _row_to_dict(
            conn.execute(SELECT_EXISTING_SQL, {"article_key": article["article_key"]}).first()
        )

        if existing is None:
            conn.execute(INSERT_ARTICLE_SQL, article)
            stats["rows_inserted"] += 1
            continue

        effective_article = _preserve_existing_success_content(article, existing)
        if _has_material_change(effective_article, existing):
            conn.execute(UPDATE_ARTICLE_SQL, effective_article)
            stats["rows_updated"] += 1
        else:
            conn.execute(TOUCH_ARTICLE_SQL, {"article_key": article["article_key"]})
            stats["rows_unchanged"] += 1

    return stats


def determine_status(articles: list[dict[str, Any]], stats: dict[str, int]) -> str:
    sources = {article.get("source_name") for article in articles}
    has_both_sources = VALID_SOURCES.issubset(sources)
    if has_both_sources and stats["parse_issue_count"] == 0:
        return "success"
    return "partial_success"


def _summary_message(stats: dict[str, int]) -> str:
    return (
        f"unchanged={stats['rows_unchanged']}; "
        f"parse_issue_count={stats['parse_issue_count']}"
    )


def run_pipeline(limit_per_source: int = 10) -> dict[str, Any]:
    database_url = load_database_url()
    print("DATABASE_URL detected; creating Supabase engine.", flush=True)
    engine = create_engine(database_url, pool_pre_ping=True)

    try:
        articles = fetch_agri_news(limit_per_source=limit_per_source)
        if not articles:
            raise RuntimeError("fetch_agri_news returned no articles.")

        with engine.begin() as conn:
            stats = upsert_articles(conn, articles)
            status = determine_status(articles, stats)
            write_log(
                conn,
                status=status,
                rows_inserted=stats["rows_inserted"],
                rows_updated=stats["rows_updated"],
                error_message=_summary_message(stats),
            )

        print(
            "Agriculture news update completed: "
            f"status={status}, inserted={stats['rows_inserted']}, "
            f"updated={stats['rows_updated']}, unchanged={stats['rows_unchanged']}, "
            f"parse_issue_count={stats['parse_issue_count']}",
            flush=True,
        )
        return {"status": status, **stats}

    except Exception as exc:
        with engine.begin() as conn:
            write_log(conn, status="failed", error_message=str(exc))
        print(f"Agriculture news update failed: {exc}", flush=True)
        raise


if __name__ == "__main__":
    run_pipeline()
