"""
模組名稱: src.weather.typhoon_alert
功能說明: 颱風警報邏輯，判斷是否有颱風影響並產生對應提示。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_weather_forecast
"""
from __future__ import annotations

import pandas as pd

from src.data.data_loader import load_weather_forecast


def get_typhoon_alert(weather: pd.DataFrame | None = None) -> dict:
    data = load_weather_forecast() if weather is None else weather.copy()
    risky = data[
        data["warning_type"].fillna("").str.contains("颱風")
        | data["typhoon_risk"].fillna("低").isin(["高", "很高"])
    ]
    if risky.empty:
        return {"active": False, "areas": [], "message": "目前示範資料沒有颱風警示"}
    areas = risky["origin_area"].astype(str).tolist()
    return {
        "active": True,
        "areas": areas,
        "message": "颱風可能影響採收與運輸，請理性準備 2～3 天用量，不要大量囤貨",
    }

