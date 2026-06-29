# -*- coding: utf-8 -*-
"""
單元測試: tests.test_update_agri_price_daily
功能說明: 測試 scripts/update_agri_price_daily.py 中的保留天數載入與防呆邏輯。
"""
from __future__ import annotations

import os
import pytest

from scripts.update_agri_price_daily import get_retention_days


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
