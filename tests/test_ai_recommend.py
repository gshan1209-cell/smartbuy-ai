import asyncio
from types import SimpleNamespace

import pytest

import backend.cache as backend_cache
import src.anomaly.price_status as price_status
from backend.routers import ai_recommend


def test_ai_recommend_returns_truthful_rules_fallback_when_llm_is_unavailable(monkeypatch):
    monkeypatch.setattr(
        ai_recommend,
        "_get_price_items",
        lambda market, top_n: [
            {"product_name": "高麗菜", "today_price": 20, "status": "便宜"},
            {"product_name": "番茄", "today_price": 70, "status": "偏貴"},
        ],
    )

    def unavailable(_prompt):
        raise ValueError("GOOGLE_API_KEY 未設定")

    monkeypatch.setattr(ai_recommend, "_call_gemini", unavailable)
    ai_recommend._ai_cache.clear()

    result = asyncio.run(
        ai_recommend.ai_recommend(
            ai_recommend.AiRecommendRequest(market="台北一", region="北部", top_n=2),
        ),
    )

    assert result["generator"] == "rules-fallback"
    assert result["llm_called"] is False
    assert "規則備援" in result["summary"]
    assert result["items"][0]["product_name"] == "高麗菜"


def test_ai_recommend_requires_market():
    with pytest.raises(ValueError):
        ai_recommend.AiRecommendRequest(region="北部")


def test_recommendation_candidates_keep_only_current_valid_price_data(monkeypatch):
    monkeypatch.setattr(backend_cache, "price_cache", {"prices": SimpleNamespace(columns=[])})
    monkeypatch.setattr(
        price_status,
        "get_all_price_statuses",
        lambda _prices: [
            {"product_name": "有效品項", "today_price": 20, "status": "便宜", "is_historical": False},
            {"product_name": "資料不足品項", "today_price": None, "status": "資料不足"},
            {"product_name": "歷史品項", "today_price": 30, "status": "正常", "is_historical": True},
        ],
    )

    result = ai_recommend._get_price_items(None, 10)

    assert [item["product_name"] for item in result] == ["有效品項"]


def test_ai_recommend_uses_labeled_static_seed_when_official_items_are_empty(monkeypatch):
    monkeypatch.setattr(ai_recommend, "_get_price_items", lambda market, top_n: [])
    monkeypatch.setattr(ai_recommend, "_call_gemini", lambda _prompt: (_ for _ in ()).throw(ValueError("offline")))
    ai_recommend._ai_cache.clear()

    result = asyncio.run(
        ai_recommend.ai_recommend(
            ai_recommend.AiRecommendRequest(market="台北一", top_n=3),
        ),
    )

    assert result["data_status"] == "static_seed"
    assert result["source_name"] == "Static Seed"
    assert len(result["items"]) == 3
    assert result["limitations"]
