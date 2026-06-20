"""
模組名稱: tests.test_recommendation
功能說明: 測試模組，確保系統各項功能正常運作。

【相關元件 (Related Components)】
- 依賴: src.recommendation.purchase_advisor.get_purchase_advice
"""
import pandas as pd

from src.recommendation.purchase_advisor import get_purchase_advice


def _prices(today_price: float) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"trans_date": f"2026-06-0{index + 1}", "product_name": "高麗菜", "market_name": "市場", "avg_price": price}
            for index, price in enumerate([30, 31, 29, 30, today_price])
        ]
    )


def test_expensive_product_recommends_alternative():
    mappings = pd.DataFrame([{"product_name": "高麗菜", "main_origins": "雲林"}])
    weather = pd.DataFrame(
        [{"origin_area": "雲林", "rain_probability": 10, "warning_type": "", "typhoon_risk": "低", "consecutive_rain_days": 0}]
    )
    result = get_purchase_advice("高麗菜", prices=_prices(50), mappings=mappings, weather=weather, target_date="2026-06-20")
    assert result["recommendation"] == "改買替代品"
    assert result["alternatives"]


def test_high_weather_risk_limits_purchase():
    mappings = pd.DataFrame([{"product_name": "高麗菜", "main_origins": "雲林"}])
    weather = pd.DataFrame(
        [{"origin_area": "雲林", "rain_probability": 90, "warning_type": "豪雨特報", "typhoon_risk": "低", "consecutive_rain_days": 3}]
    )
    result = get_purchase_advice("高麗菜", prices=_prices(30), mappings=mappings, weather=weather, target_date="2026-06-20")
    assert result["recommendation"] == "可少量購買"

