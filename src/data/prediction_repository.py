# -*- coding: utf-8 -*-
"""
模組名稱: src.data.prediction_repository
功能說明: [DEPRECATED] 舊版五日數值 Baseline 預測讀取層，優先讀取 Supabase，失敗時 fallback 讀取本機 CSV。

注意:
    本模組只服務已退出 MVP 範圍的 `prediction_results` / predicted_price 流程。
    目前前台與每日排程不得使用本模組作為正式預測資料來源。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository._load_database_url
"""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text

from src.data.price_repository import _load_database_url

PREDICTIONS_PATH = Path(__file__).resolve().parents[2] / "data/processed/prediction_results.csv"
REQUIRED_COLS = [
    "predict_date",
    "crop_code",
    "crop_name",
    "market_code",
    "market_name",
    "predicted_price",
    "predicted_status",
]


def load_predictions(
    crop_name: str | None = None,
    crop_code: str | None = None,
    market_name: str | None = None,
    market_code: str | None = None,
    limit: int = 30,
    target_date: date | None = None,
) -> pd.DataFrame:
    """
    [DEPRECATED] 載入舊版五日數值 Baseline 預測資料。優先從 Supabase 讀取，失敗時自動安全 fallback 至本機 CSV。
    預設只加載大於或等於今日的未來預測行情，並依預測日期遞增排序。
    """
    today_val = target_date or date.today()
    database_url = _load_database_url()

    if database_url:
        try:
            engine = create_engine(database_url, pool_pre_ping=True)
            sql = (
                "SELECT predict_date, crop_code, crop_name, market_code, market_name, "
                "       predicted_price, predicted_status, created_at "
                "FROM prediction_results "
                "WHERE predict_date >= :today"
            )
            params: dict[str, any] = {"today": today_val, "limit": limit}

            if crop_code:
                sql += " AND crop_code = :crop_code"
                params["crop_code"] = crop_code
            elif crop_name:
                sql += " AND crop_name = :crop_name"
                params["crop_name"] = crop_name

            if market_code:
                sql += " AND market_code = :market_code"
                params["market_code"] = market_code
            elif market_name:
                sql += " AND market_name = :market_name"
                params["market_name"] = market_name

            sql += " ORDER BY predict_date ASC LIMIT :limit;"

            df = pd.read_sql(text(sql), engine, params=params)
            
            # 轉換預測日期格式為 date 物件以保持一致
            if not df.empty:
                df["predict_date"] = pd.to_datetime(df["predict_date"]).dt.date

            df.attrs["source"] = "Supabase"
            return df
        except Exception as e:
            print(f"Supabase load_predictions 失敗，將 fallback 到本機 CSV。錯誤: {e}")

    # Fallback to local CSV
    if PREDICTIONS_PATH.exists():
        try:
            df = pd.read_csv(PREDICTIONS_PATH, dtype={"crop_code": str, "market_code": str})
            if not df.empty:
                # 欄位補齊與轉換
                df["predict_date_dt"] = pd.to_datetime(df["predict_date"]).dt.date
                
                # 過濾 predict_date >= today
                df = df[df["predict_date_dt"] >= today_val]

                # 條件過濾
                if crop_code:
                    df = df[df["crop_code"].astype(str) == str(crop_code)]
                elif crop_name:
                    df = df[df["crop_name"] == crop_name]

                if market_code:
                    df = df[df["market_code"].astype(str) == str(market_code)]
                elif market_name:
                    df = df[df["market_name"] == market_name]

                # 排序與限制數量
                df = df.sort_values("predict_date_dt", ascending=True)
                df["predict_date"] = df["predict_date_dt"]
                df = df.drop(columns=["predict_date_dt"])
                df = df.head(limit).copy()

                df.attrs["source"] = "本機 CSV"
                return df
        except Exception as csv_err:
            print(f"本機 CSV 載入失敗。錯誤: {csv_err}")

    # Return empty DataFrame with column structure
    empty_df = pd.DataFrame(columns=REQUIRED_COLS)
    empty_df.attrs["source"] = "本機 CSV"
    return empty_df
