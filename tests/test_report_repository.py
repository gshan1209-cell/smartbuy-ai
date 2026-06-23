# -*- coding: utf-8 -*-
"""
Module: tests.test_report_repository
Description: Tests for report_repository.py covering Supabase online, CSV fallback, validation, and empty official price handling.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
import pandas as pd
import pytest
from sqlalchemy import create_engine, text

import src.data.report_repository as repo


def test_validation_invalid_price():
    """Verify that reporting a price <= 0 raises ValueError."""
    with pytest.raises(ValueError, match="買入價格必須大於 0"):
        repo.add_price_report("高麗菜", 0.0, "測試市場")
    with pytest.raises(ValueError, match="買入價格必須大於 0"):
        repo.add_price_report("高麗菜", -5.0, "測試市場")


def test_fallback_to_csv_when_db_missing(monkeypatch, tmp_path):
    """Verify fallback to CSV when DATABASE_URL is not set or db connection fails."""
    monkeypatch.setattr(repo, "_load_database_url", lambda: None)
    
    csv_file = tmp_path / "reports.csv"
    result = repo.add_price_report("高麗菜", 55.0, "測試市場", path=csv_file)
    
    assert csv_file.exists()
    assert result["write_destination"] == "\u672c\u6a5f\u0020\u0043\u0053\u0056" # 本機 CSV
    assert result["product_name"] == "高麗菜"
    assert result["user_price"] == 55.0
    assert result["market_name"] == "測試市場"
    assert result["unit"] == "元/公斤"
    assert result["report_id"].startswith("R-")
    
    # Read CSV and check values
    df = pd.read_csv(csv_file)
    assert len(df) == 1
    assert df.iloc[0]["product_name"] == "高麗菜"
    assert float(df.iloc[0]["user_price"]) == 55.0


def test_db_insert_success_with_sqlite_mock(monkeypatch):
    """Verify report saving to Supabase (SQLite mock) when DB is online."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE price_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id VARCHAR(50) NOT NULL UNIQUE,
                report_date DATE NOT NULL,
                crop_name VARCHAR(100),
                product_name VARCHAR(100) NOT NULL,
                market_name VARCHAR(100) NOT NULL,
                user_price NUMERIC(10, 2) NOT NULL,
                unit VARCHAR(20) DEFAULT '元/公斤' NOT NULL,
                reference_price NUMERIC(10, 2) DEFAULT NULL,
                price_gap NUMERIC(10, 2) DEFAULT NULL,
                price_gap_percent NUMERIC(10, 4) DEFAULT NULL,
                report_note VARCHAR(255) DEFAULT '待確認',
                write_destination VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        ))
        
    monkeypatch.setattr(repo, "_load_database_url", lambda: "sqlite:///:memory:")
    monkeypatch.setattr("src.data.report_repository.create_engine", lambda url, **kwargs: engine)
    
    # Mock get_price_status to return a fixed official price of 50
    monkeypatch.setattr("src.data.report_repository.get_price_status", lambda name: {"today_price": 50.0})
    
    result = repo.add_price_report("高麗菜", 60.0, "台北一", unit="元/公斤")
    
    assert result["write_destination"] == "Supabase"
    assert result["official_avg_price"] == 50.0
    assert result["price_gap_rate"] == 0.20
    assert result["comparison"] == "\u7a0d\u9ad8"  # 稍高
    
    # Verify DB query
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM price_reports;")).first()
        assert row is not None
        assert row[1] == result["report_id"]
        assert row[3] == "高麗菜"
        assert row[4] == "高麗菜"
        assert row[5] == "台北一"
        assert float(row[6]) == 60.0
        assert row[7] == "元/公斤"
        assert float(row[8]) == 50.0
        assert float(row[9]) == 10.0
        assert float(row[10]) == 0.20
        assert row[11] == "待確認"
        assert row[12] == "Supabase"


def test_db_insert_with_missing_official_price(monkeypatch):
    """Verify that reporting works without crashing when there is no official price."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE price_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id VARCHAR(50) NOT NULL UNIQUE,
                report_date DATE NOT NULL,
                crop_name VARCHAR(100),
                product_name VARCHAR(100) NOT NULL,
                market_name VARCHAR(100) NOT NULL,
                user_price NUMERIC(10, 2) NOT NULL,
                unit VARCHAR(20) DEFAULT '元/公斤' NOT NULL,
                reference_price NUMERIC(10, 2) DEFAULT NULL,
                price_gap NUMERIC(10, 2) DEFAULT NULL,
                price_gap_percent NUMERIC(10, 4) DEFAULT NULL,
                report_note VARCHAR(255) DEFAULT '待確認',
                write_destination VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        ))
        
    monkeypatch.setattr(repo, "_load_database_url", lambda: "sqlite:///:memory:")
    monkeypatch.setattr("src.data.report_repository.create_engine", lambda url, **kwargs: engine)
    
    # Mock get_price_status to return None for official price
    monkeypatch.setattr("src.data.report_repository.get_price_status", lambda name: {"today_price": None})
    
    result = repo.add_price_report("高麗菜", 45.0, "台北一")
    
    assert result["write_destination"] == "Supabase"
    assert result["official_avg_price"] == ""
    assert result["price_gap_rate"] == ""
    assert result["comparison"] == "\u66ab\u7121\u5b98\u65b9\u884c\u60c5\u53ef\u6bd4\u5c0d"  # 暫無官方行情可比對
    
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM price_reports;")).first()
        assert row is not None
        assert row[4] == "高麗菜"
        assert row[8] is None
        assert row[9] is None
        assert row[10] is None
        assert row[11] == "待確認"
        assert row[12] == "Supabase"
