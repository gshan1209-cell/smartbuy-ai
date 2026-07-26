from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

import backend.routers.misc as misc
from src.data import agri_news_repository


NEWS_ROW = {
    "id": 1,
    "article_key": "agri_news:abc",
    "source_name": "農業部",
    "source_article_id": "10209",
    "title": "測試農業新聞",
    "published_date": date(2026, 7, 14),
    "source_url": "https://example.test/news/1",
    "content_text": "清理後正文",
    "updated_at": datetime(2026, 7, 14, 1, 2, 3, tzinfo=timezone.utc),
    "parse_error": "must not leak",
    "content_hash": "must not leak",
    "first_fetched_at": "must not leak",
    "last_fetched_at": "must not leak",
}


@pytest.fixture(autouse=True)
def isolate_news_router(monkeypatch):
    """每個案例使用獨立快取與 repository stub，避免測試順序互相污染。"""
    misc._news_cache.clear()
    monkeypatch.setattr(misc, "query_agri_news", lambda **kwargs: [])
    monkeypatch.setattr(misc, "query_agri_news_count", lambda **kwargs: 0)
    monkeypatch.setattr(misc, "query_news_sources", lambda: [])
    yield
    misc._news_cache.clear()


def _set_news_rows(monkeypatch, rows, total=None):
    monkeypatch.setattr(misc, "query_agri_news", lambda **kwargs: rows)
    monkeypatch.setattr(
        misc,
        "query_agri_news_count",
        lambda **kwargs: len(rows) if total is None else total,
    )


def test_news_api_returns_200_and_articles_array(monkeypatch, router_client_factory):
    _set_news_rows(monkeypatch, [NEWS_ROW])
    client = router_client_factory(misc.router)

    response = client.get("/api/news")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["limit"] == 12
    assert payload["offset"] == 0
    assert isinstance(payload["articles"], list)
    assert payload["articles"][0]["article_key"] == "agri_news:abc"


def test_news_api_returns_only_public_fields(monkeypatch, router_client_factory):
    _set_news_rows(monkeypatch, [NEWS_ROW])
    client = router_client_factory(misc.router)

    response = client.get("/api/news")

    article = response.json()["articles"][0]
    assert set(article.keys()) == {
        "id",
        "article_key",
        "source_name",
        "source_article_id",
        "title",
        "published_date",
        "source_url",
        "content_text",
        "updated_at",
    }
    assert "parse_error" not in article
    assert "content_hash" not in article
    assert "first_fetched_at" not in article
    assert "last_fetched_at" not in article


def test_news_api_passes_filters_to_repository(monkeypatch, router_client_factory):
    captured = {"rows": None, "count": None}

    def fake_query_agri_news(**kwargs):
        captured["rows"] = kwargs
        return []

    def fake_query_agri_news_count(**kwargs):
        captured["count"] = kwargs
        return 0

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    monkeypatch.setattr(misc, "query_agri_news_count", fake_query_agri_news_count)
    client = router_client_factory(misc.router)

    response = client.get(
        "/api/news",
        params={"source": "農糧署", "q": "颱風", "limit": 7, "offset": 3},
    )

    assert response.status_code == 200
    assert captured["rows"] == {
        "source_name": "農糧署",
        "keyword": "颱風",
        "limit": 7,
        "offset": 3,
    }
    assert captured["count"] == {
        "source_name": "農糧署",
        "keyword": "颱風",
    }


def test_news_api_accepts_dynamic_sources(monkeypatch, router_client_factory):
    captured = []

    def fake_query_agri_news(**kwargs):
        captured.append(kwargs["source_name"])
        return []

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    client = router_client_factory(misc.router)

    for source in ["自由時報", "農傳媒", "PTT Fruits"]:
        response = client.get("/api/news", params={"source": source})
        assert response.status_code == 200

    assert captured == ["自由時報", "農傳媒", "PTT Fruits"]


def test_news_api_treats_blank_source_as_unspecified(monkeypatch, router_client_factory):
    captured = {}

    def fake_query_agri_news(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    client = router_client_factory(misc.router)

    response = client.get("/api/news", params={"source": "   "})

    assert response.status_code == 200
    assert captured["source_name"] is None


def test_news_api_rejects_invalid_limit(router_client_factory):
    client = router_client_factory(misc.router)

    assert client.get("/api/news", params={"limit": 0}).status_code == 422
    assert client.get("/api/news", params={"limit": 101}).status_code == 422


def test_news_api_rejects_negative_offset(router_client_factory):
    client = router_client_factory(misc.router)

    response = client.get("/api/news", params={"offset": -1})

    assert response.status_code == 422


def test_news_api_returns_empty_payload_when_no_rows(router_client_factory):
    client = router_client_factory(misc.router)

    response = client.get("/api/news")

    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "limit": 12,
        "offset": 0,
        "articles": [],
    }


def test_news_api_returns_fixed_503_without_internal_error(monkeypatch, router_client_factory):
    def fake_query_agri_news(**kwargs):
        raise RuntimeError("postgresql://user:secret@example/db exploded")

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    client = router_client_factory(misc.router)

    response = client.get("/api/news")

    assert response.status_code == 503
    assert response.json() == {"detail": "新聞資料暫時無法取得，請稍後再試。"}
    assert "secret" not in response.text


def test_news_sources_api_returns_repository_values(monkeypatch, router_client_factory):
    monkeypatch.setattr(misc, "query_news_sources", lambda: ["農業部", "農糧署"])
    client = router_client_factory(misc.router)

    response = client.get("/api/news/sources")

    assert response.status_code == 200
    assert response.json() == {"sources": ["農業部", "農糧署"]}


def test_news_sources_api_returns_fixed_503(monkeypatch, router_client_factory):
    monkeypatch.setattr(
        misc,
        "query_news_sources",
        lambda: (_ for _ in ()).throw(RuntimeError("database secret")),
    )
    client = router_client_factory(misc.router)

    response = client.get("/api/news/sources")

    assert response.status_code == 503
    assert response.json() == {"detail": "來源資料暫時無法取得。"}
    assert "secret" not in response.text


def test_news_api_uses_cache_within_same_case(monkeypatch, router_client_factory):
    calls = {"rows": 0, "count": 0}

    def fake_query_agri_news(**kwargs):
        calls["rows"] += 1
        return [NEWS_ROW]

    def fake_query_agri_news_count(**kwargs):
        calls["count"] += 1
        return 1

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    monkeypatch.setattr(misc, "query_agri_news_count", fake_query_agri_news_count)
    client = router_client_factory(misc.router)

    assert client.get("/api/news").status_code == 200
    assert client.get("/api/news").status_code == 200

    assert calls == {"rows": 1, "count": 1}


def test_repository_sql_contains_required_filters_order_and_pagination():
    statement, _ = agri_news_repository._build_query(
        source_name="農業部",
        keyword="颱風",
    )
    sql = str(statement)

    assert "parse_status = 'success'" in sql
    assert "content_text IS NOT NULL" in sql
    assert "BTRIM(content_text) <> ''" in sql
    assert "ORDER BY published_date DESC NULLS LAST, id DESC" in sql
    assert "LIMIT :limit" in sql
    assert "OFFSET :offset" in sql


def test_repository_source_and_keyword_use_bound_parameters():
    statement, params = agri_news_repository._build_query(
        source_name="農業部",
        keyword="颱風",
    )
    sql = str(statement)

    assert "source_name = :source_name" in sql
    assert "(title ILIKE :keyword OR content_text ILIKE :keyword)" in sql
    assert "農業部" not in sql
    assert "颱風" not in sql
    assert params == {"source_name": "農業部", "keyword": "%颱風%"}
