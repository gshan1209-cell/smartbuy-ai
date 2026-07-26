from __future__ import annotations

from datetime import date

import pandas as pd

from src.data import price_repository


def test_get_db_engine_uses_shared_repository_engine(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(price_repository, "_get_engine", lambda: sentinel)

    assert price_repository.get_db_engine() is sentinel


def test_load_price_history_falls_back_to_local_data_and_filters_window(monkeypatch):
    monkeypatch.setattr(price_repository, "_get_engine", lambda: None)

    from src.data import data_loader

    frame = pd.DataFrame(
        [
            {
                "product_name": "菠菜",
                "market_name": "台北一",
                "market_code": "104",
                "avg_price": 20,
                "trans_date": "2026-07-20",
            },
            {
                "product_name": "菠菜",
                "market_name": "台北一",
                "market_code": "104",
                "avg_price": 18,
                "trans_date": "2026-05-01",
            },
            {
                "product_name": "香蕉",
                "market_name": "台北一",
                "market_code": "104",
                "avg_price": 35,
                "trans_date": "2026-07-21",
            },
        ]
    )
    monkeypatch.setattr(data_loader, "load_market_prices", lambda: frame.copy())

    result = price_repository.load_price_history(
        crop_name="菠菜",
        market_name="台北一",
        days=30,
        reference_date=date(2026, 7, 26),
    )

    assert result["product_name"].tolist() == ["菠菜"]
    assert result["avg_price"].tolist() == [20]
    assert result.attrs["source"] == "本機 CSV"
    assert "trans_date_dt" not in result.columns


def test_price_status_module_can_import_repository_history_contract():
    from src.anomaly.price_status import get_all_price_statuses

    assert callable(get_all_price_statuses)
