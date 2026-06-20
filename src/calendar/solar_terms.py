"""
模組名稱: src.calendar.solar_terms
功能說明: 24節氣相關日期與邏輯判斷函式。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_solar_terms
"""
from __future__ import annotations

from datetime import date, datetime

from src.data.data_loader import load_solar_terms


def _as_date(value: date | datetime | str | None) -> date:
    if value is None:
        return date.today()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def get_today_solar_term_advice(target_date: date | datetime | str | None = None) -> dict:
    target = _as_date(target_date)
    terms = load_solar_terms().copy()
    terms["start_key"] = terms["start_month"] * 100 + terms["start_day"]
    key = target.month * 100 + target.day
    candidates = terms[terms["start_key"] <= key]
    row = (candidates.iloc[-1] if not candidates.empty else terms.iloc[-1]).to_dict()
    products = [item for item in str(row["common_products"]).split(";") if item]
    return {
        "term_name": row["term_name"],
        "season": row["season"],
        "description": row["description"],
        "recommended_products": products,
        "shopping_tip": row["shopping_tip"],
        "health_tip": row["health_tip"],
        "risk_note": row["risk_note"],
        "reference_note": "節氣日期採固定近似日，正式版可改接中央氣象署年度資料。",
    }

