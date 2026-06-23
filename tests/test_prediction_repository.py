# -*- coding: utf-8 -*-
"""
Module: tests.test_prediction_repository
Description: Tests for prediction_repository.py covering Supabase queries, CSV fallback, sorting, date filtering, and empty data handling.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
import pandas as pd
import pytest
from sqlalchemy import create_engine, text

import src.data.prediction_repository as repo


def test_fallback_to_csv_when_db_missing(monkeypatch, tmp_path):
    """Verify load_predictions fallback to CSV when DATABASE_URL is missing."""
    monkeypatch.setattr(repo, "_load_database_url", lambda: None)
    
    # Mock CSV path
    csv_file = tmp_path / "predictions.csv"
    monkeypatch.setattr(repo, "PREDICTIONS_PATH", csv_file)
    
    # Save a mock CSV file
    data = [
        {"predict_date": "2026-06-25", "crop_code": "001", "crop_name": "\u9ad8\u9e97\u83dc", "market_code": "109", "market_name": "\u53f0\u5317\u4e00", "predicted_price": 30.0, "predicted_status": "normal"},
        {"predict_date": "2026-06-26", "crop_code": "001", "crop_name": "\u9ad8\u9e97\u83dc", "market_code": "109", "market_name": "\u53f0\u5317\u4e00", "predicted_price": 32.0, "predicted_status": "normal"},
        {"predict_date": "2026-06-24", "crop_code": "001", "crop_name": "\u9ad8\u9e97\u83dc", "market_code": "109", "market_name": "\u53f0\u5317\u4e00", "predicted_price": 28.0, "predicted_status": "normal"},
    ]
    pd.DataFrame(data).to_csv(csv_file, index=False)
    
    # Load with target_date = 2026-06-25 (so 2026-06-24 should be filtered out)
    df = repo.load_predictions(crop_code="001", market_code="109", target_date=date(2026, 6, 25))
    
    assert df.attrs["source"] == "\u672c\u6a5f\u0020\u0043\u0053\u0056"
    assert len(df) == 2
    # Check date sorting (ASC)
    assert df.iloc[0]["predict_date"].strftime("%Y-%m-%d") == "2026-06-25"
    assert df.iloc[1]["predict_date"].strftime("%Y-%m-%d") == "2026-06-26"


def test_db_query_success_with_sqlite_mock(monkeypatch):
    """Verify load_predictions reads from database with correct filtering and sorting."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE prediction_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                predict_date DATE NOT NULL,
                crop_code VARCHAR(50) NOT NULL,
                crop_name VARCHAR(100),
                market_code VARCHAR(50) NOT NULL,
                market_name VARCHAR(100),
                predicted_price NUMERIC,
                predicted_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (predict_date, crop_code, market_code)
            );
            """
        ))
        
        # Insert test data: 3 dates, out of order chronologically
        conn.execute(text(
            """
            INSERT INTO prediction_results (predict_date, crop_code, crop_name, market_code, market_name, predicted_price, predicted_status)
            VALUES 
            ('2026-06-25', '001', '高麗菜', '109', '台北一', 30.0, 'normal'),
            ('2026-06-26', '001', '高麗菜', '109', '台北一', 32.0, 'normal'),
            ('2026-06-24', '001', '高麗菜', '109', '台北一', 28.0, 'normal'),
            ('2026-06-25', '002', '小白菜', '109', '台北一', 22.0, 'cheap');
            """
        ))
        
    monkeypatch.setattr(repo, "_load_database_url", lambda: "sqlite:///:memory:")
    monkeypatch.setattr("src.data.prediction_repository.create_engine", lambda url, **kwargs: engine)
    
    # Query with target_date = 2026-06-25 (6-24 should be filtered out)
    df = repo.load_predictions(crop_code="001", market_code="109", target_date=date(2026, 6, 25))
    
    assert df.attrs["source"] == "Supabase"
    assert len(df) == 2
    # Verify ASC sorting: 6-25, then 6-26
    assert df.iloc[0]["predict_date"].strftime("%Y-%m-%d") == "2026-06-25"
    assert df.iloc[1]["predict_date"].strftime("%Y-%m-%d") == "2026-06-26"
    assert float(df.iloc[0]["predicted_price"]) == 30.0
    assert float(df.iloc[1]["predicted_price"]) == 32.0


def test_empty_predictions_handling(monkeypatch, tmp_path):
    """Verify load_predictions handles missing data gracefully (no crash, returns empty df)."""
    # 1. DB is offline
    monkeypatch.setattr(repo, "_load_database_url", lambda: None)
    
    # 2. CSV does not exist
    csv_file = tmp_path / "non_existent.csv"
    monkeypatch.setattr(repo, "PREDICTIONS_PATH", csv_file)
    
    df = repo.load_predictions(crop_code="001", market_code="109")
    assert df.empty
    assert df.attrs["source"] == "\u672c\u6a5f\u0020\u0043\u0053\u0056"
    assert list(df.columns) == repo.REQUIRED_COLS
