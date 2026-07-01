"""
模組名稱: src.data.weather_loader
功能說明: 載入本地 weather_daily.csv，提供天氣歷史資料讀取層。
         未來接 Supabase 只需要改這個檔案，呼叫端不動。

【相關元件 (Related Components)】
- 依賴: data/weather/weather_daily.csv（由 scripts/fetch_weather_history.py 產生）
- 被依賴: src.weather.weather_impact
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
WEATHER_CSV = PROJECT_ROOT / "data" / "weather" / "weather_daily.csv"


@lru_cache(maxsize=1)
def _load_raw() -> pd.DataFrame:
    if not WEATHER_CSV.exists():
        return pd.DataFrame(
            columns=["obs_date", "station_id", "station_name",
                     "avg_temp", "max_temp", "min_temp", "precipitation", "county"]
        )
    df = pd.read_csv(WEATHER_CSV, parse_dates=["obs_date"])
    return df


def load_weather_history(counties: list[str] | None = None) -> pd.DataFrame:
    """
    回傳天氣歷史資料。
    counties 若指定，只回傳該縣市資料。
    """
    df = _load_raw().copy()
    if counties:
        df = df[df["county"].isin(counties)]
    return df.sort_values("obs_date").reset_index(drop=True)


def clear_cache() -> None:
    """供測試或重新載入使用。"""
    _load_raw.cache_clear()
