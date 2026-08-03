from __future__ import annotations

import pandas as pd

import backend.cache as cache


def _prices(date: str, price: float) -> pd.DataFrame:
    frame = pd.DataFrame([
        {
            "trans_date": date,
            "product_name": "香蕉",
            "market_name": "台中市",
            "avg_price": price,
            "volume": 100,
        },
    ])
    frame.attrs["source"] = "Supabase"
    frame.attrs["reference_date"] = date
    return frame


def test_demo_price_cache_reloads_when_database_trade_date_changes(monkeypatch):
    previous = cache.price_cache.copy()
    cache.price_cache.clear()
    frames = iter([_prices("2026-07-31", 30), _prices("2026-08-03", 28)])
    source_dates = iter([("2026-08-03", "Supabase")])
    load_calls = []

    monkeypatch.setattr(cache, "load_price_history", lambda **_: load_calls.append(True) or next(frames))
    monkeypatch.setattr(cache, "get_latest_trans_date", lambda: next(source_dates))
    monkeypatch.setattr(cache, "get_all_price_statuses", lambda **_: [])
    monkeypatch.setattr(cache, "compute_market_intel", lambda: {"latest_trade_date": "2026-08-03"})

    try:
        cache.preload_market_cache()
        cache.price_cache["prices_source_checked_at"] = 0

        current = cache.get_current_prices()

        assert len(load_calls) == 2
        assert current.iloc[0]["avg_price"] == 28
        assert cache.price_cache["prices_latest_date"] == "2026-08-03"
    finally:
        cache.price_cache.clear()
        cache.price_cache.update(previous)


def test_injected_demo_frame_is_not_replaced_by_live_probe(monkeypatch):
    previous = cache.price_cache.copy()
    cache.price_cache.clear()
    injected = _prices("2026-07-31", 30)
    cache.price_cache["prices"] = injected

    def fail_probe():
        raise AssertionError("測試注入的展示資料不應觸發資料庫探測")

    monkeypatch.setattr(cache, "get_latest_trans_date", fail_probe)

    try:
        assert cache.get_current_prices() is injected
    finally:
        cache.price_cache.clear()
        cache.price_cache.update(previous)
