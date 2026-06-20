"""
模組名稱: src.weather.origin_weather_risk
功能說明: 產地天氣風險判斷，依據產地降雨與氣象給出風險等級。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_product_origins
- 依賴: src.data.data_loader.load_weather_forecast
"""
from __future__ import annotations

import pandas as pd

from src.data.data_loader import load_product_origins, load_weather_forecast


RISK_ORDER = {"低": 0, "中": 1, "高": 2, "很高": 3}


def classify_weather_row(row: pd.Series) -> str:
    warning = str(row.get("warning_type", ""))
    typhoon = str(row.get("typhoon_risk", "低"))
    rain = float(row.get("rain_probability", 0) or 0)
    consecutive = int(row.get("consecutive_rain_days", 0) or 0)
    if typhoon in {"高", "很高"} or "颱風" in warning:
        return "很高"
    if "豪雨" in warning or consecutive >= 3:
        return "高"
    if rain >= 60 or consecutive >= 2:
        return "中"
    return "低"


def get_origin_weather_risk(
    product_name: str,
    mappings: pd.DataFrame | None = None,
    weather: pd.DataFrame | None = None,
) -> dict:
    mappings = load_product_origins() if mappings is None else mappings.copy()
    weather = load_weather_forecast() if weather is None else weather.copy()
    match = mappings[mappings["product_name"] == product_name]
    if match.empty:
        return {
            "product_name": product_name,
            "origins": [],
            "risk_level": "資料不足",
            "message": "尚未建立這個品項的主要產地資料",
        }

    origins = str(match.iloc[0]["main_origins"]).split(";")
    selected = weather[weather["origin_area"].isin(origins)].copy()
    if selected.empty:
        return {
            "product_name": product_name,
            "origins": origins,
            "risk_level": "資料不足",
            "message": "主要產地目前沒有天氣資料",
        }

    selected["risk_level"] = selected.apply(classify_weather_row, axis=1)
    risk = max(selected["risk_level"], key=lambda item: RISK_ORDER[item])
    messages = {
        "低": "產地天氣大致穩定",
        "中": "部分產地可能下雨，價格可能受影響",
        "高": "產地有豪雨或連日降雨，葉菜價格可能波動",
        "很高": "颱風可能影響採收與運輸，建議準備 2～3 天用量",
    }
    return {
        "product_name": product_name,
        "origins": origins,
        "risk_level": risk,
        "message": messages[risk],
        "affected_origins": selected.loc[
            selected["risk_level"].map(RISK_ORDER) >= RISK_ORDER["中"], "origin_area"
        ].tolist(),
    }

