from __future__ import annotations

from datetime import date, datetime, timezone
import sys
import types

from fastapi.testclient import TestClient

from src.data import agri_news_repository


fake_db = types.ModuleType("backend.db")
fake_db.get_session = lambda: None
sys.modules.setdefault("backend.db", fake_db)

import backend.main as main


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


def test_news_api_returns_200_and_news_array(monkeypatch):
    monkeypatch.setattr(main, "query_agri_news", lambda **kwargs: [NEWS_ROW])
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert response.json()[0]["article_key"] == "agri_news:abc"


def test_news_api_returns_only_public_fields(monkeypatch):
    monkeypatch.setattr(main, "query_agri_news", lambda **kwargs: [NEWS_ROW])
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert set(response.json()[0].keys()) == {
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
    assert "parse_error" not in response.json()[0]
    assert "content_hash" not in response.json()[0]
    assert "first_fetched_at" not in response.json()[0]
    assert "last_fetched_at" not in response.json()[0]


def test_news_api_passes_filters_to_repository(monkeypatch):
    captured = {}

    def fake_query_agri_news(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(main, "query_agri_news", fake_query_agri_news)
    client = TestClient(main.app)

    response = client.get(
        "/api/news",
        params={"source": "農糧署", "q": "颱風", "limit": 7, "offset": 3},
    )

    assert response.status_code == 200
    assert captured == {
        "source_name": "農糧署",
        "keyword": "颱風",
        "limit": 7,
        "offset": 3,
    }


def test_news_api_rejects_invalid_source():
    client = TestClient(main.app)

    response = client.get("/api/news", params={"source": "其他來源"})

    assert response.status_code == 422


def test_news_api_rejects_invalid_limit():
    client = TestClient(main.app)

    assert client.get("/api/news", params={"limit": 0}).status_code == 422
    assert client.get("/api/news", params={"limit": 101}).status_code == 422


def test_news_api_rejects_negative_offset():
    client = TestClient(main.app)

    response = client.get("/api/news", params={"offset": -1})

    assert response.status_code == 422


def test_news_api_returns_empty_array_when_no_rows(monkeypatch):
    monkeypatch.setattr(main, "query_agri_news", lambda **kwargs: [])
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert response.status_code == 200
    assert response.json() == []


def test_news_api_returns_fixed_503_without_internal_error(monkeypatch):
    def fake_query_agri_news(**kwargs):
        raise RuntimeError("postgresql://user:secret@example/db exploded")

    monkeypatch.setattr(main, "query_agri_news", fake_query_agri_news)
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert response.status_code == 503
    assert response.json() == {"detail": "新聞資料暫時無法取得，請稍後再試。"}
    assert "secret" not in response.text


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
