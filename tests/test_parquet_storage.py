"""
模組名稱: tests.test_parquet_storage
功能說明: 測試 Parquet 歷史資料儲存、讀取與去重邏輯，以及預測儲存之離線降級。

【相關元件 (Related Components)】
- 依賴: src.data.parquet_store
- 依賴: src.data.data_loader
- 依賴: src.data.prediction_store
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
import pandas as pd
import pytest

from src.data.parquet_store import save_df_to_monthly_parquet
from src.data.data_loader import load_historical_prices_for_ml
from src.data.prediction_store import save_predictions_to_supabase


@pytest.fixture
def mock_parquet_dir(tmp_path, monkeypatch):
    """將 Parquet 儲存目錄與資料讀取目錄重新導向至測試用暫存目錄。"""
    # 建立暫存的 data/history_parquet 結構
    test_data_dir = tmp_path / "data"
    test_parquet_dir = test_data_dir / "history_parquet"
    test_parquet_dir.mkdir(parents=True, exist_ok=True)

    # 進行 monkeypatch
    monkeypatch.setattr("src.data.parquet_store.PARQUET_DIR", test_parquet_dir)
    monkeypatch.setattr("src.data.data_loader.PROJECT_ROOT", tmp_path)
    
    return test_parquet_dir


def test_save_and_load_parquet(mock_parquet_dir):
    """測試將資料寫入 Parquet 並以 load_historical_prices_for_ml 讀回。"""
    data = [
        {
            "trans_date": date(2026, 5, 15),
            "crop_code": "001",
            "crop_name": "高麗菜",
            "market_code": "109",
            "market_name": "台北一",
            "upper_price": 40.0,
            "middle_price": 30.0,
            "lower_price": 20.0,
            "avg_price": 30.0,
            "volume": 1000.0,
        },
        {
            "trans_date": date(2026, 6, 1),
            "crop_code": "002",
            "crop_name": "小白菜",
            "market_code": "109",
            "market_name": "台北一",
            "upper_price": 35.0,
            "middle_price": 25.0,
            "lower_price": 15.0,
            "avg_price": 25.0,
            "volume": 800.0,
        }
    ]
    df = pd.DataFrame(data)

    # 執行儲存
    total_saved = save_df_to_monthly_parquet(df)
    assert total_saved == 2

    # 驗證是否產生兩個月份的 Parquet 檔案
    assert (mock_parquet_dir / "agri_price_2026-05.parquet").exists()
    assert (mock_parquet_dir / "agri_price_2026-06.parquet").exists()

    # 讀取 2026-05 月份的歷史資料
    loaded_df = load_historical_prices_for_ml(start_date="2026-05-01", end_date="2026-05-31")
    assert len(loaded_df) == 1
    assert loaded_df.iloc[0]["crop_name"] == "高麗菜"
    assert loaded_df.iloc[0]["crop_code"] == "001"

    # 讀取全部歷史資料
    loaded_all = load_historical_prices_for_ml()
    assert len(loaded_all) == 2


def test_parquet_deduplication(mock_parquet_dir):
    """測試 Parquet 寫入時的重疊資料去重邏輯（ON CONFLICT 更新）。"""
    # 第一次寫入一筆資料
    data1 = [
        {
            "trans_date": "2026-05-15",
            "crop_code": "001",
            "crop_name": "高麗菜",
            "market_code": "109",
            "market_name": "台北一",
            "upper_price": 40.0,
            "middle_price": 30.0,
            "lower_price": 20.0,
            "avg_price": 30.0,
            "volume": 1000.0,
        }
    ]
    df1 = pd.DataFrame(data1)
    save_df_to_monthly_parquet(df1)

    # 第二次寫入相同主鍵但有更新價格的資料
    data2 = [
        {
            "trans_date": "2026-05-15",
            "crop_code": "001",
            "crop_name": "高麗菜",
            "market_code": "109",
            "market_name": "台北一",
            "upper_price": 45.0, # 更新上價
            "middle_price": 35.0, # 更新中價
            "lower_price": 25.0,
            "avg_price": 35.0, # 更新平均價
            "volume": 1200.0,  # 更新交易量
        }
    ]
    df2 = pd.DataFrame(data2)
    save_df_to_monthly_parquet(df2)

    # 驗證合併後只有一筆，且保留了最新的第二筆資料值
    loaded_df = load_historical_prices_for_ml(start_date="2026-05-01", end_date="2026-05-31")
    assert len(loaded_df) == 1
    assert loaded_df.iloc[0]["avg_price"] == 35.0
    assert loaded_df.iloc[0]["volume"] == 1200.0


def test_load_historical_prices_filtering(mock_parquet_dir):
    """測試 load_historical_prices_for_ml 的作物、市場與日期篩選條件。"""
    data = [
        {"trans_date": "2026-05-10", "crop_code": "001", "crop_name": "高麗菜", "market_code": "109", "market_name": "台北一", "upper_price": 10, "middle_price": 8, "lower_price": 5, "avg_price": 8, "volume": 100},
        {"trans_date": "2026-05-11", "crop_code": "001", "crop_name": "高麗菜", "market_code": "220", "market_name": "板橋區", "upper_price": 12, "middle_price": 9, "lower_price": 6, "avg_price": 9, "volume": 120},
        {"trans_date": "2026-05-12", "crop_code": "002", "crop_name": "小白菜", "market_code": "109", "market_name": "台北一", "upper_price": 15, "middle_price": 12, "lower_price": 10, "avg_price": 12, "volume": 150},
    ]
    df = pd.DataFrame(data)
    save_df_to_monthly_parquet(df)

    # 1. 僅篩選作物代號 '001'
    df_crop = load_historical_prices_for_ml(crop_code="001")
    assert len(df_crop) == 2
    assert (df_crop["crop_code"] == "001").all()

    # 2. 僅篩選市場代號 '109'
    df_market = load_historical_prices_for_ml(market_code="109")
    assert len(df_market) == 2
    assert (df_market["market_code"] == "109").all()

    # 3. 篩選多個作物代號 ['001', '002']
    df_multi = load_historical_prices_for_ml(crop_code=["001", "002"])
    assert len(df_multi) == 3

    # 4. 篩選日期區間
    df_dates = load_historical_prices_for_ml(start_date="2026-05-11", end_date="2026-05-12")
    assert len(df_dates) == 2
    dates = df_dates["trans_date"].dt.strftime("%Y-%m-%d").tolist()
    assert "2026-05-10" not in dates


def test_prediction_store_offline_graceful(monkeypatch):
    """測試在沒有設定 DATABASE_URL 環境變數下，save_predictions_to_supabase 應優雅退出而不當機。"""
    # 確保 _load_database_url 返回 None，模擬離線環境
    monkeypatch.setattr("src.data.prediction_store._load_database_url", lambda: None)

    # 建立一個測試用的預測結果 DataFrame
    data = [
        {
            "predict_date": "2026-06-25",
            "crop_code": "001",
            "crop_name": "高麗菜",
            "market_code": "109",
            "market_name": "台北一",
            "predicted_price": 32.5,
            "predicted_status": "normal",
        }
    ]
    df = pd.DataFrame(data)

    # save_predictions_to_supabase 應回傳 0，且無例外拋出。
    result = save_predictions_to_supabase(df)
    assert result == 0

