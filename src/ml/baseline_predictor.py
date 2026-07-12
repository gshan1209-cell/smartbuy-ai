# -*- coding: utf-8 -*-
"""
模組名稱: src.ml.baseline_predictor
功能說明: [DEPRECATED] 舊版五日數值 Baseline 預測核心邏輯，包括 MA7 價格計算與 MA30/全均值狀態分類。

注意:
    此模組已退出正式 MVP 範圍。正式 MVP 使用 LightGBM 下一交易日方向分類，
    並寫入 `price_direction_predictions`。

【相關元件 (Related Components)】
- 依賴: pandas
"""
from __future__ import annotations

import warnings
from datetime import date, timedelta
import pandas as pd


def predict_next_5_days(
    history_df: pd.DataFrame,
    crop_code: str,
    crop_name: str,
    market_code: str,
    market_name: str,
    forecast_start_date: date | None = None,
    days: int = 5,
) -> pd.DataFrame:
    """
    [DEPRECATED] 計算給定歷史交易行情下，特定作物與市場組合未來幾天的價格預測及狀態。
    
    預測原則：
    1. 依交易日期遞增排序，排除 avg_price 為空或小於等於 0 的異常紀錄。
    2. 有效紀錄數小於 7 筆時跳過預測，傳回空 DataFrame。
    3. 預測價格：使用最新 7 筆有效交易平均價（MA7）。
    4. 比較均價：若有效紀錄 7~29 筆，使用全部有效交易均價；若 >= 30 筆，使用最新 30 筆有效交易均價。
    5. 漲跌狀態判定：
       - 預測價格 < 比較均價 * 0.9 => 'cheap' (便宜)
       - 預測價格 > 比較均價 * 1.1 => 'expensive' (偏貴)
       - 其餘 => 'normal' (正常)
    6. 預測日期從今日（或傳入的 forecast_start_date）開始計算，不產生早於今天的預測。
    
    參數:
        history_df: 歷史行情資料，須含 ['trans_date', 'avg_price'] 欄位。
        crop_code: 作物代碼。
        crop_name: 作物名稱。
        market_code: 市場代碼。
        market_name: 市場名稱。
        forecast_start_date: 預測開始日期，預設為今日。
        days: 預測天數。
        
    回傳:
        pd.DataFrame: 未來預測資料集。
    """
    columns = [
        "predict_date",
        "crop_code",
        "crop_name",
        "market_code",
        "market_name",
        "predicted_price",
        "predicted_status",
    ]
    
    # 確保參數型別
    crop_code = str(crop_code)
    crop_name = str(crop_name)
    market_code = str(market_code)
    market_name = str(market_name)
    
    today_val = date.today()
    start_date = forecast_start_date or today_val
    
    # 防範過期日期：預測開始日期不得早於今天
    if start_date < today_val:
        start_date = today_val

    if history_df is None or history_df.empty:
        warnings.warn(f"[{crop_name} - {market_name}] 歷史資料為空，跳過預測。")
        return pd.DataFrame(columns=columns)

    # 1. 依 trans_date 排序與篩選異常值
    df_clean = history_df.copy()
    df_clean["trans_date"] = pd.to_datetime(df_clean["trans_date"])
    df_clean = df_clean.sort_values("trans_date", ascending=True)
    df_clean = df_clean.dropna(subset=["avg_price"])
    df_clean = df_clean[df_clean["avg_price"] > 0]

    valid_count = len(df_clean)
    
    # 2. 有效資料少於 7 筆時跳過
    if valid_count < 7:
        warnings.warn(
            f"[{crop_name} - {market_name}] 有效歷史資料僅 {valid_count} 筆（少於 7 筆），無法計算 MA7。跳過預測。"
        )
        return pd.DataFrame(columns=columns)

    # 3. 計算預測價格 (MA7)
    predicted_price = float(df_clean.tail(7)["avg_price"].mean())

    # 4. 判斷比較基準均價
    if valid_count < 30:
        comparison_mean = float(df_clean["avg_price"].mean())
    else:
        comparison_mean = float(df_clean.tail(30)["avg_price"].mean())

    # 5. 決定漲跌預警狀態
    if predicted_price < comparison_mean * 0.9:
        status = "cheap"
    elif predicted_price > comparison_mean * 1.1:
        status = "expensive"
    else:
        status = "normal"

    # 6. 產生未來天數預測資料
    records = []
    for i in range(days):
        pred_date = start_date + timedelta(days=i)
        records.append({
            "predict_date": pred_date,
            "crop_code": crop_code,
            "crop_name": crop_name,
            "market_code": market_code,
            "market_name": market_name,
            "predicted_price": round(predicted_price, 2),
            "predicted_status": status,
        })

    return pd.DataFrame(records, columns=columns)
