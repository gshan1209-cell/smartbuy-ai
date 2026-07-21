"""
模組名稱: src.recommendation.purchase_advisor
功能說明: 採買建議整合器，依價格狀態給出建議。

【相關元件 (Related Components)】
- 依賴: src.anomaly.price_status.get_all_price_statuses
- 依賴: src.anomaly.price_status.get_price_status
"""
from __future__ import annotations

import pandas as pd

from src.anomaly.price_status import get_price_status


def get_purchase_advice(
    product_name: str,
    prices: pd.DataFrame | None = None,
    market_name: str | None = None,
    target_date: str | None = None,
) -> dict:
    price = get_price_status(product_name, prices=prices, market_name=market_name)

    if price["status"] == "資料不足":
        advice = "資料還不夠，目前僅供參考"
        label = "資料不足"
    elif price["status"] == "偏貴":
        advice = "今天價格偏高，建議先觀望"
        label = "建議觀望"
    elif price["status"] == "便宜":
        advice = "價格合適，可以依需要購買"
        label = "推薦購買"
    else:
        advice = "價格接近平常，可依家中需要購買"
        label = "推薦購買"

    return {
        "product_name": product_name,
        "today_price": price["today_price"],
        "price_status": price["status"],
        "recommendation": label,
        "advice": advice,
        "price_detail": price,
    }


def get_bargain_recommendations(prices: pd.DataFrame | None = None) -> list[dict]:
    from src.anomaly.price_status import get_all_price_statuses

    results = get_all_price_statuses(prices)
    rank = {"便宜": 0, "正常": 1, "偏貴": 2, "資料不足": 3}
    return sorted(results, key=lambda item: (rank[item["status"]], item["product_name"]))[:5]
