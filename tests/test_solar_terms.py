"""
模組名稱: tests.test_solar_terms
功能說明: 測試節氣天文計算。
"""
from datetime import date

from src.calendar.solar_terms import get_current_solar_term


def test_summer_solstice():
    # 2026 夏至約在 6/21，6/22 應已是小暑之前的夏至節氣
    result = get_current_solar_term(today=date(2026, 6, 22))
    assert result["term_name"] == "夏至"


def test_minor_heat():
    # 2026 小暑約在 7/7，7/10 應顯示小暑
    result = get_current_solar_term(today=date(2026, 7, 10))
    assert result["term_name"] == "小暑"


def test_early_january():
    # 1/1 通常還在冬至節氣（冬至約 12/22，小寒約 1/5）
    result = get_current_solar_term(today=date(2026, 1, 1))
    assert result["term_name"] == "冬至"


def test_returns_term_name_key():
    result = get_current_solar_term()
    assert "term_name" in result
    assert isinstance(result["term_name"], str)
    assert len(result["term_name"]) == 2
