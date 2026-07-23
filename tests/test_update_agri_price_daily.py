# -*- coding: utf-8 -*-
"""
單元測試: tests.test_update_agri_price_daily
功能說明: 測試 scripts/update_agri_price_daily.py 中的保留天數載入與防呆邏輯。
"""
from __future__ import annotations

import os
from datetime import date

import pandas as pd
import pytest

from scripts.update_agri_price_daily import get_retention_days, save_local_price_csv


def test_get_retention_days_default(monkeypatch):
    """測試在未設定環境變數時，預設值應為 365。"""
    monkeypatch.delenv("SMARTBUY_PRICE_RETENTION_DAYS", raising=False)
    assert get_retention_days() == 365


def test_get_retention_days_custom(monkeypatch):
    """測試設定為自定義天數時（例如 90），應能正確解析。"""
    monkeypatch.setenv("SMARTBUY_PRICE_RETENTION_DAYS", "90")
    assert get_retention_days() == 90


def test_get_retention_days_invalid_format(monkeypatch):
    """測試設定為非數字字串時，應拋出 ValueError。"""
    monkeypatch.setenv("SMARTBUY_PRICE_RETENTION_DAYS", "invalid_day")
    with pytest.raises(ValueError) as excinfo:
        get_retention_days()
    assert "必須是有效的整數" in str(excinfo.value)


def test_get_retention_days_less_than_one(monkeypatch):
    """測試設定為小於 1 的數字時（如 0 或負數），應拋出 ValueError。"""
    monkeypatch.setenv("SMARTBUY_PRICE_RETENTION_DAYS", "0")
    with pytest.raises(ValueError) as excinfo:
        get_retention_days()
    assert "必須大於或等於 1" in str(excinfo.value)

    monkeypatch.setenv("SMARTBUY_PRICE_RETENTION_DAYS", "-10")
    with pytest.raises(ValueError) as excinfo:
        get_retention_days()
    assert "必須大於或等於 1" in str(excinfo.value)


def test_save_local_price_csv_merges_deduplicates_and_prunes(tmp_path):
    path = tmp_path / "market_prices.csv"
    path.write_text(
        "trans_date,product_name,market_name,avg_price,volume\n"
        "2026-06-01,高麗菜,台北一,30,100\n"
        "2026-07-22,高麗菜,台北一,40,200\n",
        encoding="utf-8",
    )
    incoming = pd.DataFrame(
        [
            {
                "trans_date": date(2026, 7, 22),
                "crop_name": "高麗菜",
                "market_name": "台北一",
                "avg_price": 45,
                "volume": 250,
            },
            {
                "trans_date": date(2026, 7, 23),
                "crop_name": "香蕉",
                "market_name": "台北一",
                "avg_price": 35,
                "volume": 300,
            },
        ]
    )

    saved_rows = save_local_price_csv(incoming, path=path, retention_days=30)
    saved = pd.read_csv(path)

    assert saved_rows == 2
    assert set(saved["product_name"]) == {"高麗菜", "香蕉"}
    assert saved.loc[saved["product_name"] == "高麗菜", "avg_price"].item() == 45
