from __future__ import annotations

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.cache import price_cache
from backend.routers.market import router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_markets_can_be_filtered_by_category_and_region():
    previous = price_cache.get("prices")
    price_cache["prices"] = pd.DataFrame([
        {"product_name": "菠菜", "market_name": "台北一"},
        {"product_name": "香蕉", "market_name": "台北一"},
        {"product_name": "菠菜", "market_name": "台中市"},
        {"product_name": "菠菜", "market_name": "南投市"},
    ])
    try:
        response = _client().get("/api/markets?category=leafy-vegetables&region=north")
    finally:
        if previous is None:
            price_cache.pop("prices", None)
        else:
            price_cache["prices"] = previous

    assert response.status_code == 200
    assert response.json() == {"markets": ["台北一"]}


def test_markets_reject_unknown_category():
    response = _client().get("/api/markets?category=unknown")

    assert response.status_code == 422
