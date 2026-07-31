from __future__ import annotations

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.cache import price_cache
from backend.demo_catalog import (
    DEMO_CROP_NAMES,
    DEMO_GRAND_CROP_IDS,
    DEMO_MARKET_CROPS,
    DEMO_MARKET_TOP_CROPS,
    DEMO_MARKETS,
    demo_crop_names,
)
from backend.routers.market import router as market_router
from backend.routers.product import router as product_router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(market_router)
    app.include_router(product_router)
    return TestClient(app)


def _demo_prices() -> pd.DataFrame:
    rows = []
    for market_code, market_name in DEMO_MARKETS.items():
        for rank, crop_id in enumerate(DEMO_MARKET_CROPS[market_code], start=1):
            rows.append({
                "trans_date": "2026-07-30",
                "crop_code": crop_id,
                "crop_name": DEMO_CROP_NAMES[crop_id],
                "product_name": DEMO_CROP_NAMES[crop_id],
                "market_code": market_code,
                "market_name": market_name,
                "avg_price": 10 + rank,
                "upper_price": 12 + rank,
                "middle_price": 10 + rank,
                "lower_price": 8 + rank,
                "volume": 1000 - rank,
            })
    rows.extend([
        {**rows[0], "crop_code": "ZZZ", "crop_name": "白名單外", "product_name": "白名單外"},
        {**rows[0], "market_code": "999", "market_name": "非指定市場"},
    ])
    return pd.DataFrame(rows)


def test_demo_market_and_crop_lists_use_the_shared_grand_catalog(monkeypatch):
    monkeypatch.setitem(price_cache, "prices", _demo_prices())
    client = _client()

    assert client.get("/api/markets").json() == {"markets": ["台中市", "台北一", "高雄市"]}
    for market_name in DEMO_MARKETS.values():
        payload = client.get("/api/products", params={"market": market_name}).json()
        assert len(payload) == len(DEMO_GRAND_CROP_IDS) == 22
        assert [item["product_name"] for item in payload] == list(demo_crop_names(market_name))
        assert all("其他" not in item["product_name"] for item in payload)
        assert all("休市" not in item["product_name"] for item in payload)
        assert all(item["market_name"] == market_name for item in payload)


def test_grand_catalog_is_the_stable_union_of_each_market_top_ten():
    expected = tuple(dict.fromkeys(
        crop_id
        for top_ten in DEMO_MARKET_TOP_CROPS.values()
        for crop_id in top_ten
    ))
    assert DEMO_GRAND_CROP_IDS == expected
    assert all(len(top_ten) == 10 for top_ten in DEMO_MARKET_TOP_CROPS.values())
    assert all(crops == expected for crops in DEMO_MARKET_CROPS.values())


def test_demo_detail_allows_only_matching_market_crop(monkeypatch):
    monkeypatch.setitem(price_cache, "prices", _demo_prices())
    client = _client()

    allowed = client.get("/api/products/芒果-金煌", params={"market": "台中市"})
    assert allowed.status_code == 200
    assert allowed.json()["product_name"] == "芒果-金煌"

    assert client.get("/api/products/芒果-金煌", params={"market": "非指定市場"}).status_code == 404
    assert client.get("/api/products/白名單外", params={"market": "台中市"}).status_code == 404
    assert client.get("/api/products/芒果-金煌", params={"market": "台北一"}).status_code == 200


def test_demo_history_rejects_missing_and_invalid_pairs(monkeypatch):
    def fail_if_called(**_kwargs):
        raise AssertionError("白名單外配對不應查詢實際資料")

    monkeypatch.setattr("backend.routers.product.load_price_history", fail_if_called)
    client = _client()

    assert client.get("/api/products/芒果-金煌/history", params={"market": "非指定市場"}).json() == {"history": []}
    assert client.get("/api/products/白名單外/history", params={"market": "台中市"}).json() == {"history": []}


def test_market_can_return_fewer_grand_catalog_items_when_source_has_no_row(monkeypatch):
    prices = _demo_prices()
    prices = prices[~((prices["market_name"] == "台北一") & (prices["crop_code"] == "R6"))]
    monkeypatch.setitem(price_cache, "prices", prices)
    payload = _client().get("/api/products", params={"market": "台北一"}).json()

    assert len(payload) == len(DEMO_GRAND_CROP_IDS) - 1
    assert "芒果-金煌" not in {item["product_name"] for item in payload}


def test_product_list_without_or_with_unknown_market_returns_no_data(monkeypatch):
    monkeypatch.setitem(price_cache, "prices", _demo_prices())
    client = _client()

    assert len(client.get("/api/products").json()) == 66
    assert client.get("/api/products", params={"market": "非指定市場"}).json() == []


def test_all_markets_concatenates_independent_market_rows_without_aggregation(monkeypatch):
    prices = _demo_prices()
    target = prices["crop_code"] == "R6"
    prices.loc[target & (prices["market_name"] == "台中市"), ["avg_price", "volume"]] = [10, 100]
    prices.loc[target & (prices["market_name"] == "台北一"), ["avg_price", "volume"]] = [30, 200]
    prices.loc[target & (prices["market_name"] == "高雄市"), ["avg_price", "volume"]] = [40, 700]
    prices.loc[target & (prices["market_name"] == "非指定市場"), ["avg_price", "volume"]] = [999, 9999]
    monkeypatch.setitem(price_cache, "prices", prices)
    client = _client()

    all_markets = client.get("/api/products").json()
    shared_crop_rows = [
        item for item in all_markets if item["product_name"] == "芒果-金煌"
    ]
    assert [
        (item["market_name"], item["today_price"], item["volume"])
        for item in shared_crop_rows
    ] == [
        ("台中市", 10.0, 100),
        ("台北一", 30.0, 200),
        ("高雄市", 40.0, 700),
    ]
    assert not any(item["volume"] == 1000 for item in shared_crop_rows)
    assert not any(item["today_price"] == 33.0 for item in shared_crop_rows)

    single_market_payloads = {
        market_name: client.get("/api/products", params={"market": market_name}).json()
        for market_name in DEMO_MARKETS.values()
    }
    assert len(all_markets) == sum(len(items) for items in single_market_payloads.values())
    for item in shared_crop_rows:
        single_market_item = next(
            candidate
            for candidate in single_market_payloads[item["market_name"]]
            if candidate["product_name"] == item["product_name"]
        )
        assert item["today_price"] == single_market_item["today_price"]
        assert item["volume"] == single_market_item["volume"]
    assert {item["market_name"] for item in all_markets} == set(DEMO_MARKETS.values())


def test_all_markets_keeps_product_query_filter(monkeypatch):
    monkeypatch.setitem(price_cache, "prices", _demo_prices())
    payload = _client().get("/api/products", params={"q": "芒果"}).json()

    assert len(payload) == 6
    assert {item["product_name"] for item in payload} == {"芒果-金煌", "芒果-愛文"}
    assert {item["market_name"] for item in payload} == set(DEMO_MARKETS.values())
