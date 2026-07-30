"""
模組名稱: src.anomaly.price_status
功能說明: 判斷菜價偏貴、正常或便宜的狀態邏輯。

【相關元件 (Related Components)】
- 依賴: src.anomaly.sigma_detector.detect_price_status
- 依賴: src.data.data_loader.load_market_prices
"""
from __future__ import annotations

import pandas as pd

from src.anomaly.sigma_detector import detect_price_status
from src.data.price_repository import load_price_history


STATUS_SUGGESTIONS = {
    "偏貴": "今天價格比平常高，建議少量購買或看看替代品",
    "便宜": "今天價格相對划算，可以列入採買清單",
    "正常": "今天價格接近平常水準，可以依需要購買",
    "資料不足": "資料還不夠多，目前結果僅供參考",
}


def _safe_round(value, ndigits: int = 1):
    """數值若為 None/NaN 則回傳 None，否則四捨五入。"""
    if value is None or pd.isna(value):
        return None
    return round(float(value), ndigits)


def get_price_status(
    product_name: str,
    market_name: str | None = None,
    prices: pd.DataFrame | None = None,
) -> dict:
    data = load_price_history(days=30) if prices is None else prices.copy()
    selected = data[data["product_name"] == product_name]
    if market_name:
        selected = selected[selected["market_name"] == market_name]
    if selected.empty:
        return {
            "product_name": product_name,
            "today_price": None,
            "market_name": market_name,
            "status": "資料不足",
            "reason": "目前沒有這個品項的行情資料",
            "suggestion": STATUS_SUGGESTIONS["資料不足"],
            "recent_average": None,
            "trans_date": None,
            "upper_price": None,
            "middle_price": None,
            "lower_price": None,
            "volume": None,
        }

    selected = selected.sort_values("trans_date")
    result = detect_price_status(selected["avg_price"])
    latest = selected.iloc[-1]
    market = str(latest["market_name"])
    reason = {
        "偏貴": "今天價格明顯高於近期平均",
        "便宜": "今天價格明顯低於近期平均",
        "正常": "今天價格在近期常見範圍內",
        "資料不足": "近期資料筆數不足",
    }[result.status]
    return {
        "product_name": product_name,
        "today_price": round(result.today_price, 1),
        "market_name": market,
        "status": result.status,
        "reason": reason,
        "suggestion": STATUS_SUGGESTIONS[result.status],
        "recent_average": round(result.mean_price, 1) if result.mean_price is not None else None,
        "trans_date": str(latest["trans_date"]) if latest.get("trans_date") is not None else None,
        "upper_price": _safe_round(latest.get("upper_price")),
        "middle_price": _safe_round(latest.get("middle_price")),
        "lower_price": _safe_round(latest.get("lower_price")),
        "volume": _safe_round(latest.get("volume"), 0),
    }


def get_all_price_statuses(
    prices: pd.DataFrame | None = None,
    market_name: str | None = None,
) -> list[dict]:
    data = load_price_history(days=30) if prices is None else prices.copy()
    if market_name:
        data = data[data["market_name"] == market_name]
    return [get_price_status(name, prices=data) for name in sorted(data["product_name"].unique())]

