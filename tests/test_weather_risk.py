"""
模組名稱: tests.test_weather_risk
功能說明: 測試模組，確保系統各項功能正常運作。

【相關元件 (Related Components)】
- 依賴: src.weather.origin_weather_risk.classify_weather_row
- 依賴: src.weather.origin_weather_risk.get_origin_weather_risk
"""
import pandas as pd

from src.weather.origin_weather_risk import classify_weather_row, get_origin_weather_risk


def test_heavy_rain_is_high_risk():
    row = pd.Series(
        {"rain_probability": 80, "warning_type": "豪雨特報", "typhoon_risk": "低", "consecutive_rain_days": 1}
    )
    assert classify_weather_row(row) == "高"


def test_product_risk_uses_highest_origin_risk():
    mappings = pd.DataFrame([{"product_name": "高麗菜", "main_origins": "雲林;彰化"}])
    weather = pd.DataFrame(
        [
            {"origin_area": "雲林", "rain_probability": 80, "warning_type": "豪雨特報", "typhoon_risk": "低", "consecutive_rain_days": 3},
            {"origin_area": "彰化", "rain_probability": 10, "warning_type": "", "typhoon_risk": "低", "consecutive_rain_days": 0},
        ]
    )
    result = get_origin_weather_risk("高麗菜", mappings=mappings, weather=weather)
    assert result["risk_level"] == "高"
    assert "雲林" in result["affected_origins"]

