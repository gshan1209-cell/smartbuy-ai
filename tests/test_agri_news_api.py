from __future__ import annotations

from datetime import date, datetime, timezone
import sys
import types

from fastapi.testclient import TestClient
from fastapi import APIRouter

from src.data import agri_news_repository


fake_db = types.ModuleType("backend.db")
fake_db.get_session = lambda: None
sys.modules.setdefault("backend.db", fake_db)

fake_price_status = types.ModuleType("src.anomaly.price_status")
fake_price_status.get_all_price_statuses = lambda prices=None: []
sys.modules.setdefault("src.anomaly.price_status", fake_price_status)

fake_purchase_advisor = types.ModuleType("src.recommendation.purchase_advisor")
fake_purchase_advisor.get_bargain_recommendations = lambda prices=None: []
fake_purchase_advisor.get_purchase_advice = lambda name: {"product_name": name}
sys.modules.setdefault("src.recommendation.purchase_advisor", fake_purchase_advisor)

fake_price_repository = types.ModuleType("src.data.price_repository")
fake_price_repository.load_price_history = lambda days=30: []
fake_price_repository.load_latest_prices = lambda: types.SimpleNamespace(
    __getitem__=lambda self, key: self,
    unique=lambda: [],
    tolist=lambda: [],
)
sys.modules.setdefault("src.data.price_repository", fake_price_repository)

fake_cache = types.ModuleType("backend.cache")
fake_cache.price_cache = {}
fake_cache.compute_market_intel = lambda: {}
fake_cache.build_product_weather_risks = lambda: []
sys.modules.setdefault("backend.cache", fake_cache)

fake_solar_terms = types.ModuleType("src.calendar.solar_terms")
fake_solar_terms.get_current_solar_term = lambda: {}
sys.modules.setdefault("src.calendar.solar_terms", fake_solar_terms)

fake_typhoon_alert = types.ModuleType("src.weather.typhoon_alert")
fake_typhoon_alert.get_typhoon_alert = lambda: {}
sys.modules.setdefault("src.weather.typhoon_alert", fake_typhoon_alert)

fake_origin_weather_risk = types.ModuleType("src.weather.origin_weather_risk")
fake_origin_weather_risk.get_origin_weather_risk = lambda name: {"risk_level": "資料不足"}
sys.modules.setdefault("src.weather.origin_weather_risk", fake_origin_weather_risk)

fake_weather_impact = types.ModuleType("src.weather.weather_impact")
fake_weather_impact.get_weather_summary = lambda: {}
sys.modules.setdefault("src.weather.weather_impact", fake_weather_impact)

for router_module_name in [
    "backend.routers.auth",
    "backend.routers.market",
    "backend.routers.product",
    "backend.routers.prediction",
]:
    fake_router_module = types.ModuleType(router_module_name)
    fake_router_module.router = APIRouter()
    sys.modules.setdefault(router_module_name, fake_router_module)

import backend.main as main
import backend.routers.misc as misc


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
    monkeypatch.setattr(misc, "query_agri_news", lambda **kwargs: [NEWS_ROW])
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert response.json()[0]["article_key"] == "agri_news:abc"


def test_news_api_returns_only_public_fields(monkeypatch):
    monkeypatch.setattr(misc, "query_agri_news", lambda **kwargs: [NEWS_ROW])
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

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
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


def test_news_api_accepts_dynamic_sources(monkeypatch):
    captured = []

    def fake_query_agri_news(**kwargs):
        captured.append(kwargs["source_name"])
        return []

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    client = TestClient(main.app)

    for source in ["自由時報", "農傳媒", "PTT Fruits"]:
        response = client.get("/api/news", params={"source": source})
        assert response.status_code == 200

    assert captured == ["自由時報", "農傳媒", "PTT Fruits"]


def test_news_api_treats_blank_source_as_unspecified(monkeypatch):
    captured = {}

    def fake_query_agri_news(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
    client = TestClient(main.app)

    response = client.get("/api/news", params={"source": "   "})

    assert response.status_code == 200
    assert captured["source_name"] is None


def test_news_api_rejects_invalid_limit():
    client = TestClient(main.app)

    assert client.get("/api/news", params={"limit": 0}).status_code == 422
    assert client.get("/api/news", params={"limit": 101}).status_code == 422


def test_news_api_rejects_negative_offset():
    client = TestClient(main.app)

    response = client.get("/api/news", params={"offset": -1})

    assert response.status_code == 422


def test_news_api_returns_empty_array_when_no_rows(monkeypatch):
    monkeypatch.setattr(misc, "query_agri_news", lambda **kwargs: [])
    client = TestClient(main.app)

    response = client.get("/api/news")

    assert response.status_code == 200
    assert response.json() == []


def test_news_api_returns_fixed_503_without_internal_error(monkeypatch):
    def fake_query_agri_news(**kwargs):
        raise RuntimeError("postgresql://user:secret@example/db exploded")

    monkeypatch.setattr(misc, "query_agri_news", fake_query_agri_news)
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
