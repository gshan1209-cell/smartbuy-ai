"""
模組名稱: src.data.data_loader
功能說明: 基礎資料載入器，處理 CSV 或 JSON 格式的來源資料。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _read_csv(relative_path: str, **kwargs) -> pd.DataFrame:
    path = PROJECT_ROOT / relative_path
    if not path.exists():
        raise FileNotFoundError(f"找不到資料檔：{path}")
    return pd.read_csv(path, **kwargs)


def load_market_prices() -> pd.DataFrame:
    data = _read_csv("data/processed/market_prices.csv")
    data["trans_date"] = pd.to_datetime(data["trans_date"])
    return data.sort_values(["product_name", "trans_date"]).reset_index(drop=True)


def load_weather_forecast() -> pd.DataFrame:
    data = _read_csv("data/processed/weather_forecast.csv")
    data["forecast_date"] = pd.to_datetime(data["forecast_date"])
    return data


def load_product_origins() -> pd.DataFrame:
    return _read_csv("data/mapping/product_origin_mapping.csv")


def load_solar_terms() -> pd.DataFrame:
    return _read_csv("data/calendar/solar_terms.csv")


def load_seasonal_products() -> pd.DataFrame:
    return _read_csv("data/calendar/seasonal_products.csv")


def latest_market_rows(prices: pd.DataFrame | None = None) -> pd.DataFrame:
    prices = load_market_prices() if prices is None else prices.copy()
    return (
        prices.sort_values("trans_date")
        .groupby(["product_name", "market_name"], as_index=False)
        .tail(1)
        .reset_index(drop=True)
    )

