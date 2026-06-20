"""
模組名稱: tests.test_price_status
功能說明: 測試模組，確保系統各項功能正常運作。

【相關元件 (Related Components)】
- 依賴: src.anomaly.price_status.get_price_status
- 依賴: src.anomaly.sigma_detector.detect_price_status
"""
import pandas as pd

from src.anomaly.price_status import get_price_status
from src.anomaly.sigma_detector import detect_price_status


def test_sigma_detects_expensive_price():
    result = detect_price_status([30, 31, 29, 30, 45])
    assert result.status == "偏貴"


def test_sigma_reports_insufficient_history():
    result = detect_price_status([30, 31, 32])
    assert result.status == "資料不足"


def test_price_status_returns_friendly_missing_result():
    frame = pd.DataFrame(
        [{"trans_date": "2026-01-01", "product_name": "高麗菜", "market_name": "市場", "avg_price": 30}]
    )
    result = get_price_status("不存在", prices=frame)
    assert result["status"] == "資料不足"
    assert result["today_price"] is None

