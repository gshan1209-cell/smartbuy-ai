"""
模組名稱: src.recommendation.seasonal_recommender
功能說明: 當季推薦邏輯，根據節氣推薦適合的食材。

【相關元件 (Related Components)】
- 依賴: src.calendar.solar_terms.get_today_solar_term_advice
- 依賴: src.data.data_loader.load_seasonal_products
"""
from __future__ import annotations

from datetime import date, datetime

from src.calendar.solar_terms import get_today_solar_term_advice
from src.data.data_loader import load_seasonal_products


def get_seasonal_recommendations(
    target_date: date | datetime | str | None = None,
) -> list[dict]:
    term = get_today_solar_term_advice(target_date)
    data = load_seasonal_products()
    selected = data[data["best_terms"].str.split(";").apply(lambda terms: term["term_name"] in terms)]
    return [
        {
            "product_name": row.product_name,
            "reason": row.reason,
            "suggested_cooking": row.suggested_cooking,
            "storage_tip": row.storage_tip,
        }
        for row in selected.itertuples()
    ]

