"""
模組名稱: src.data.prediction_store
功能說明: 提供機器學習預測結果寫回 Supabase `prediction_results` 資料表的功能。

【相關元件 (Related Components)】
- 依賴: sqlalchemy
- 依賴: pandas
"""
from __future__ import annotations

import os
import tomllib
from datetime import date, datetime
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]

def _load_database_url() -> str | None:
    """
    讀取 DATABASE_URL。
    優先順序：
    1. 環境變數 DATABASE_URL
    2. 本機 .streamlit/secrets.toml
    3. Streamlit secrets
    """
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    secrets_path = PROJECT_ROOT / ".streamlit" / "secrets.toml"
    if secrets_path.exists():
        try:
            with secrets_path.open("rb") as file:
                secrets = tomllib.load(file)
            url = secrets.get("DATABASE_URL")
            if url:
                return url
        except Exception:
            pass

    try:
        import streamlit as st
        return st.secrets.get("DATABASE_URL")
    except Exception:
        pass

    return None


def save_predictions_to_supabase(predictions_df: pd.DataFrame) -> int:
    """
    將機器學習預測結果寫入 Supabase 中的 `prediction_results` 資料表。
    若資料表不存在，會自動建立該表。
    使用 UPSERT (ON CONFLICT DO UPDATE) 寫入，以 (predict_date, crop_code, market_code) 作為唯一鍵。

    參數:
        predictions_df: 包含預測結果的 pandas DataFrame。
                        必要欄位: ['predict_date', 'crop_code', 'crop_name', 'market_code', 'market_name', 'predicted_price', 'predicted_status']

    回傳:
        int: 寫入/更新的預測結果筆數。
    """
    if predictions_df.empty:
        print("預測資料為空，不執行寫入。")
        return 0

    # 檢查必要欄位
    required_cols = [
        "predict_date", "crop_code", "crop_name", "market_code", "market_name",
        "predicted_price", "predicted_status"
    ]
    for col in required_cols:
        if col not in predictions_df.columns:
            raise ValueError(f"預測資料 DataFrame 缺少必要欄位: {col}")

    database_url = _load_database_url()
    if not database_url:
        print("未偵測到 DATABASE_URL，無法將預測結果寫回 Supabase。")
        return 0

    engine = create_engine(database_url, pool_pre_ping=True)

    create_table_sql = text(
        """
        CREATE TABLE IF NOT EXISTS prediction_results (
            id SERIAL PRIMARY KEY,
            predict_date DATE NOT NULL,
            crop_code VARCHAR(50) NOT NULL,
            crop_name VARCHAR(100),
            market_code VARCHAR(50) NOT NULL,
            market_name VARCHAR(100),
            predicted_price NUMERIC,
            predicted_status VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE (predict_date, crop_code, market_code)
        );
        """
    )

    upsert_sql = text(
        """
        INSERT INTO prediction_results (
            predict_date,
            crop_code,
            crop_name,
            market_code,
            market_name,
            predicted_price,
            predicted_status,
            created_at
        )
        VALUES (
            :predict_date,
            :crop_code,
            :crop_name,
            :market_code,
            :market_name,
            :predicted_price,
            :predicted_status,
            NOW()
        )
        ON CONFLICT (predict_date, crop_code, market_code)
        DO UPDATE SET
            crop_name = EXCLUDED.crop_name,
            market_name = EXCLUDED.market_name,
            predicted_price = EXCLUDED.predicted_price,
            predicted_status = EXCLUDED.predicted_status,
            created_at = NOW();
        """
    )

    # 確保資料格式轉換正確
    records_df = predictions_df.copy()
    def format_date(d) -> str:
        if isinstance(d, (date, datetime, pd.Timestamp)):
            return d.strftime("%Y-%m-%d")
        return str(d).split(" ")[0] if " " in str(d) else str(d)
        
    records_df["predict_date"] = records_df["predict_date"].apply(format_date)
    records = records_df[required_cols].to_dict(orient="records")

    with engine.begin() as conn:
        # 自動建立資料表
        conn.execute(create_table_sql)
        # 執行批次寫入
        conn.execute(upsert_sql, records)

    print(f"成功將 {len(records)} 筆預測結果寫入 Supabase 'prediction_results' 表。", flush=True)
    return len(records)
