# -*- coding: utf-8 -*-
"""
Module: tests.test_home_view
Description: Tests for home_view.py
"""
from __future__ import annotations

from datetime import date
import pandas as pd
import pytest

import app.home_view as home_view


class MockStreamlit:
    def __init__(self):
        self.titles = []
        self.subheaders = []
        self.infos = []
        self.warnings = []
        self.errors = []
        self.headers = []
        self.successes = []
        self.texts = []
        self.markdowns = []
        self.captions = []
        self.columns_count = []

    def title(self, text, *args, **kwargs):
        self.titles.append(text)

    def subheader(self, text, *args, **kwargs):
        self.subheaders.append(text)

    def info(self, text, *args, **kwargs):
        self.infos.append(text)

    def warning(self, text, *args, **kwargs):
        self.warnings.append(text)

    def error(self, text, *args, **kwargs):
        self.errors.append(text)

    def header(self, text, *args, **kwargs):
        self.headers.append(text)

    def success(self, text, *args, **kwargs):
        self.successes.append(text)

    def write(self, text, *args, **kwargs):
        self.texts.append(text)

    def markdown(self, text, *args, **kwargs):
        self.markdowns.append(text)

    def caption(self, text, *args, **kwargs):
        self.captions.append(text)

    def columns(self, spec, *args, **kwargs):
        self.columns_count.append(spec)
        class MockCol:
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc_val, exc_tb):
                pass
        return [MockCol() for _ in range(spec)]


def test_render_home_with_supabase_data(monkeypatch):
    df = pd.DataFrame([
        {
            "trans_date": date(2026, 6, 20),
            "crop_code": "001",
            "crop_name": "\u9ad8\u9e97\u83dc",
            "product_name": "\u9ad8\u9e97\u83dc",
            "market_code": "109",
            "market_name": "\u53f0\u5317\u4e00",
            "avg_price": 25.0,
            "volume": 1000
        }
    ])
    df.attrs["source"] = "Supabase"

    monkeypatch.setattr(home_view, "load_price_history", lambda days: df)
    
    mock_rec = [{"product_name": "\u9ad8\u9e97\u83dc", "status": "\u4fbf\u5b9c", "today_price": 25.0, "suggestion": "\u4fbf\u5b9c\u8cb7\uff01"}]
    monkeypatch.setattr(home_view, "get_bargain_recommendations", lambda prices: mock_rec)

    mock_st = MockStreamlit()
    monkeypatch.setattr(home_view, "st", mock_st)

    monkeypatch.setattr(home_view, "get_typhoon_alert", lambda: {"active": False, "message": ""})
    monkeypatch.setattr(home_view, "get_origin_weather_risk", lambda name: {"message": "ok", "risk_level": "low"})

    home_view.render_home()

    assert any("Supabase" in info for info in mock_st.infos)
    assert any("2026-06-20" in info for info in mock_st.infos)
    assert not mock_st.warnings


def test_render_home_fallback_to_csv(monkeypatch):
    df = pd.DataFrame([
        {
            "trans_date": date(2026, 6, 18),
            "crop_code": "",
            "crop_name": "\u9ad8\u9e97\u83dc",
            "product_name": "\u9ad8\u9e97\u83dc",
            "market_code": "",
            "market_name": "\u53f0\u5317\u4e00",
            "avg_price": 22.0,
            "volume": 900
        }
    ])
    df.attrs["source"] = "\u672c\u6a5f CSV"

    monkeypatch.setattr(home_view, "load_price_history", lambda days: df)
    
    mock_rec = [{"product_name": "\u9ad8\u9e97\u83dc", "status": "\u6b63\u5e38", "today_price": 22.0, "suggestion": "\u6b63\u5e38\u8cb7\uff01"}]
    monkeypatch.setattr(home_view, "get_bargain_recommendations", lambda prices: mock_rec)

    mock_st = MockStreamlit()
    monkeypatch.setattr(home_view, "st", mock_st)
    import app.common as common
    monkeypatch.setattr(common, "st", mock_st)

    monkeypatch.setattr(home_view, "get_typhoon_alert", lambda: {"active": False, "message": ""})
    monkeypatch.setattr(home_view, "get_origin_weather_risk", lambda name: {"message": "ok", "risk_level": "low"})

    home_view.render_home()

    assert any("Supabase" in warn for warn in mock_st.warnings)
    assert any("2026-06-18" in warn for warn in mock_st.warnings)
    assert not any("Supabase" in info for info in mock_st.infos)
    assert len(mock_st.captions) > 0


def test_render_home_empty_data_no_crash(monkeypatch):
    df = pd.DataFrame(columns=["trans_date", "crop_name", "product_name", "market_name", "avg_price", "volume"])
    df.attrs["source"] = "\u672c\u6a5f CSV"

    monkeypatch.setattr(home_view, "load_price_history", lambda days: df)

    def fail_if_called(*args, **kwargs):
        pytest.fail("get_bargain_recommendations should NOT be called when history_df is empty!")

    monkeypatch.setattr(home_view, "get_bargain_recommendations", fail_if_called)

    mock_st = MockStreamlit()
    monkeypatch.setattr(home_view, "st", mock_st)
    import app.common as common
    monkeypatch.setattr(common, "st", mock_st)

    monkeypatch.setattr(home_view, "get_typhoon_alert", lambda: {"active": False, "message": ""})
    monkeypatch.setattr(home_view, "get_origin_weather_risk", lambda name: {"message": "empty", "risk_level": "low"})

    home_view.render_home()

    assert any(info for info in mock_st.infos if "Price Search" not in info)
    assert any("Supabase" in warn for warn in mock_st.warnings)
