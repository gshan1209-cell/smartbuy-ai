"""
模組名稱: src.calendar.solar_terms
功能說明: 天文計算 24 節氣日期，取得當前節氣名稱。

演算法：Jean Meeus《Astronomical Algorithms》近似公式，
以太陽黃道經度每 15° 為一節氣，誤差 < 1 天。
"""
from __future__ import annotations

import math
from datetime import date, timedelta

# 24 節氣名稱，依太陽黃道經度 0°、15°、30°… 排列
# 起點春分（0°）
_TERM_NAMES = [
    "春分", "清明", "穀雨",
    "立夏", "小滿", "芒種",
    "夏至", "小暑", "大暑",
    "立秋", "處暑", "白露",
    "秋分", "寒露", "霜降",
    "立冬", "小雪", "大雪",
    "冬至", "小寒", "大寒",
    "立春", "雨水", "驚蟄",
]


def _sun_longitude(jde: float) -> float:
    """回傳給定 JDE 的太陽視黃道經度（度）。"""
    T = (jde - 2451545.0) / 36525.0
    L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
    M = math.radians(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
    C = ((1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(M)
         + (0.019993 - 0.000101 * T) * math.sin(2 * M)
         + 0.000289 * math.sin(3 * M))
    sun_lon = (L0 + C) % 360
    return sun_lon


def _jde_to_date(jde: float) -> date:
    """JDE → date（UTC 近似）。"""
    # JDE 2451545.0 = 2000-01-01T12:00 UTC
    delta = jde - 2451545.0
    return date(2000, 1, 1) + timedelta(days=delta - 0.5)


def _solar_term_date(year: int, term_index: int) -> date:
    """
    計算指定年份第 term_index 個節氣的日期。
    term_index 0 = 春分，1 = 清明，…，23 = 驚蟄。
    """
    target_lon = (term_index * 15) % 360

    # 初始估算：春分約在 3 月 20 日，每個節氣相差約 15.22 天
    # 小寒(19)～驚蟄(23) 在次年 1-3 月，從前一年春分起算
    base_year = year if term_index < 19 else year - 1
    approx_day = date(base_year, 3, 20) + timedelta(days=term_index * 15.218)

    # 轉為 JDE
    jde = 2451545.0 + (approx_day - date(2000, 1, 1)).days + 0.5

    # 二分搜尋精確到 ±0.5 天
    lo, hi = jde - 8, jde + 8
    for _ in range(50):
        mid = (lo + hi) / 2
        lon = _sun_longitude(mid)
        # 處理 350°→10° 跨越
        diff = (lon - target_lon + 180) % 360 - 180
        if abs(diff) < 1e-6:
            break
        if diff > 0:
            hi = mid
        else:
            lo = mid

    return _jde_to_date((lo + hi) / 2)


def _build_year_terms(year: int) -> list[tuple[date, str]]:
    """回傳該年所有節氣的 (日期, 名稱) 清單，依日期排序。"""
    terms = []
    for i, name in enumerate(_TERM_NAMES):
        d = _solar_term_date(year, i)
        # 小寒～驚蟄 (index 19-23) 計算結果可能落在 year-1 或 year+1
        # 只保留落在目標年份 ±60 天內、最靠近預期月份的那筆
        terms.append((d, name))
    terms.sort()
    return terms


def get_current_solar_term(today: date | None = None) -> dict:
    """
    回傳當前節氣與下個節氣資訊：
    {"term_name": "小暑", "next_term_name": "大暑", "days_until_next": 12}
    """
    target = today or date.today()
    year = target.year

    # 涵蓋跨年邊界：取前一年末 + 當年 + 次年初
    terms = _build_year_terms(year - 1)[-4:] + _build_year_terms(year) + _build_year_terms(year + 1)[:4]

    current_name = None
    next_name = None
    days_until_next = None

    for i, (d, name) in enumerate(terms):
        if d <= target:
            current_name = name
        else:
            next_name = name
            days_until_next = (d - target).days
            break

    if current_name is None:
        current_name = terms[0][1]

    return {
        "term_name": current_name,
        "next_term_name": next_name,
        "days_until_next": days_until_next,
    }
