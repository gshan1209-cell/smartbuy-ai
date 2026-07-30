"""
模組名稱: tests.test_price_repository
功能說明: 測試 price_repository.py 統一價格存取層功能，涵蓋 Supabase 優先、CSV fallback、資料來源標記與欄位對齊。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository
"""
from __future__ import annotations

from datetime import date
import pandas as pd
import pytest
from sqlalchemy import create_engine, text

import src.data.price_repository as repo


def test_fallback_to_csv_when_db_missing(monkeypatch):
    """測試當 DATABASE_URL 不存在時，自動 fallback 到本機 CSV 且資料來源標記為『本機 CSV』。"""
    monkeypatch.setattr(repo, "_load_database_url", lambda: None)
    
    # 測試 load_latest_prices
    df = repo.load_latest_prices(limit=5)
    assert not df.empty
    assert df.attrs["source"] == "本機 CSV"
    assert "crop_name" in df.columns
    assert "product_name" in df.columns
    assert (df["crop_name"] == df["product_name"]).all()
    
    # 測試 get_latest_trans_date
    latest_date, source = repo.get_latest_trans_date()
    assert latest_date is not None
    assert source == "本機 CSV"


def test_db_query_success_with_sqlite_mock(monkeypatch):
    """使用 SQLite 記憶體資料庫模擬 Supabase 查詢成功之流程。"""
    # 1. 建立記憶體 SQLite 並寫入測試資料
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE agri_price_daily (
                trans_date DATE,
                crop_code VARCHAR(50),
                crop_name VARCHAR(100),
                market_code VARCHAR(50),
                market_name VARCHAR(100),
                upper_price NUMERIC,
                middle_price NUMERIC,
                lower_price NUMERIC,
                avg_price NUMERIC,
                volume NUMERIC
            );
            """
        ))
        conn.execute(text(
            """
            INSERT INTO agri_price_daily (trans_date, crop_code, crop_name, market_code, market_name, upper_price, middle_price, lower_price, avg_price, volume)
            VALUES 
            ('2026-06-20', '001', '高麗菜', '109', '台北一', 30.0, 25.0, 20.0, 25.0, 1000),
            ('2026-06-20', '002', '小白菜', '109', '台北一', 25.0, 20.0, 15.0, 20.0, 800),
            ('2026-06-19', '001', '高麗菜', '109', '台北一', 28.0, 24.0, 18.0, 24.0, 950);
            """
        ))

    # Mock DB 連線取得與引擎建立
    monkeypatch.setattr(repo, "_load_database_url", lambda: "sqlite:///:memory:")
    monkeypatch.setattr("src.data.price_repository.create_engine", lambda url, **kwargs: engine)

    # 2. 測試 load_latest_prices：應讀到 2026-06-20 的兩筆最新價格，且來源標示為 Supabase
    df_latest = repo.load_latest_prices()
    assert len(df_latest) == 2
    assert df_latest.attrs["source"] == "Supabase"
    assert (df_latest["trans_date"].astype(str) == "2026-06-20").all()
    assert "product_name" in df_latest.columns
    assert (df_latest["product_name"] == df_latest["crop_name"]).all()

    # 3. 測試 search_prices 精確與模糊查詢
    # 精確篩選
    df_exact = repo.search_prices(crop_name="高麗菜")
    assert len(df_exact) == 2
    assert df_exact.attrs["source"] == "Supabase"
    
    # 模糊篩選 (keyword)
    df_keyword = repo.search_prices(keyword="小白")
    assert len(df_keyword) == 1
    assert df_keyword.iloc[0]["crop_name"] == "小白菜"

    # 4. 測試 load_price_history 歷史價格載入 (傳入 reference_date 避免測試依賴真實系統日期)
    df_history = repo.load_price_history(crop_name="高麗菜", days=5, reference_date=date(2026, 6, 24))
    assert len(df_history) == 2  # 應有 6-19 與 6-20 兩筆
    assert df_history.attrs["source"] == "Supabase"

    # 5. 測試 get_latest_trans_date
    latest_date, source = repo.get_latest_trans_date()
    assert latest_date == "2026-06-20"
    assert source == "Supabase"


def test_supabase_search_empty_not_fallback(monkeypatch):
    """測試當 Supabase 成功查詢但無符合結果時，應傳回空 DataFrame 且標記為 Supabase，不要 fallback 到 CSV。"""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE agri_price_daily (
                trans_date DATE,
                crop_code VARCHAR(50),
                crop_name VARCHAR(100),
                market_code VARCHAR(50),
                market_name VARCHAR(100),
                upper_price NUMERIC,
                middle_price NUMERIC,
                lower_price NUMERIC,
                avg_price NUMERIC,
                volume NUMERIC
            );
            """
        ))
        # 寫入其他作物的資料
        conn.execute(text(
            "INSERT INTO agri_price_daily (trans_date, crop_code, crop_name) VALUES ('2026-06-20', '001', '洋蔥');"
        ))

    monkeypatch.setattr(repo, "_load_database_url", lambda: "sqlite:///:memory:")
    monkeypatch.setattr("src.data.price_repository.create_engine", lambda url, **kwargs: engine)

    # 搜尋一個不存在的作物 "奇異果"
    df_result = repo.search_prices(crop_name="奇異果")
    
    # 預期：應回傳空 DataFrame，且 source 為 Supabase，不得 fallback 到本機 CSV
    assert df_result.empty
    assert df_result.attrs["source"] == "Supabase"


def test_empty_database_and_csv_fallback_graceful(monkeypatch):
    """測試當資料庫異常且 CSV 讀取也無資料（極端空狀況）時，程式不會崩潰。"""
    # 模擬連線例外，強制 fallback 到本機 CSV
    monkeypatch.setattr(repo, "_load_database_url", lambda: "invalid_url")
    
    # 故意將 CSV 載入 Mock 成回傳空 DataFrame
    import src.data.data_loader as dl
    monkeypatch.setattr(dl, "load_market_prices", lambda: pd.DataFrame(columns=["trans_date", "product_name", "market_name", "avg_price", "volume"]))
    monkeypatch.setattr(dl, "latest_market_rows", lambda: pd.DataFrame(columns=["trans_date", "product_name", "market_name", "avg_price", "volume"]))
    
    df_latest = repo.load_latest_prices()
    assert df_latest.empty
    assert df_latest.attrs["source"] == "本機 CSV"
