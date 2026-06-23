"""
模組名稱: src.data.data_loader
功能說明: 基礎資料載入器，處理 CSV 或 JSON 格式的來源資料。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

from datetime import date
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


def load_historical_prices_for_ml(
    start_date: date | str | None = None,
    end_date: date | str | None = None,
    crop_code: str | list[str] | None = None,
    market_code: str | list[str] | None = None,
) -> pd.DataFrame:
    """
    從本機 Parquet 數據湖載入歷史菜價資料以進行 ML 訓練。

    參數:
        start_date: 開始日期，格式為 YYYY-MM-DD 或 date 物件。
        end_date: 結束日期，格式為 YYYY-MM-DD 或 date 物件。
        crop_code: 作物代號，可以是單一字串或清單。
        market_code: 市場代號，可以是單一字串或清單。

    回傳:
        pd.DataFrame: 載入並經篩選後的歷史交易資料。
    """
    from datetime import date
    import re
    parquet_dir = PROJECT_ROOT / "data" / "history_parquet"
    columns = [
        "trans_date", "crop_code", "crop_name", "market_code", "market_name",
        "upper_price", "middle_price", "lower_price", "avg_price", "volume"
    ]
    
    if not parquet_dir.exists():
        return pd.DataFrame(columns=columns)

    # 找出所有分月的 Parquet 檔案
    parquet_files = sorted(parquet_dir.glob("agri_price_*.parquet"))
    if not parquet_files:
        return pd.DataFrame(columns=columns)

    # 解析並篩選出符合月份區間的檔案
    start_ym = None
    end_ym = None
    
    if start_date:
        s_date_str = start_date.strftime("%Y-%m-%d") if isinstance(start_date, date) else str(start_date)
        start_ym = s_date_str[:7]
    if end_date:
        e_date_str = end_date.strftime("%Y-%m-%d") if isinstance(end_date, date) else str(end_date)
        end_ym = e_date_str[:7]

    dfs = []
    pattern = re.compile(r"agri_price_(\d{4}-\d{2})\.parquet")

    for file in parquet_files:
        match = pattern.search(file.name)
        if not match:
            continue
        ym = match.group(1)
        
        # 篩選月份
        if start_ym and ym < start_ym:
            continue
        if end_ym and ym > end_ym:
            continue
            
        try:
            m_df = pd.read_parquet(file)
            dfs.append(m_df)
        except Exception as e:
            print(f"載入 Parquet 檔案 {file} 失敗: {e}")

    if not dfs:
        return pd.DataFrame(columns=columns)

    df = pd.concat(dfs, ignore_index=True)
    df["trans_date"] = pd.to_datetime(df["trans_date"])

    # 依日期過濾
    if start_date:
        df = df[df["trans_date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["trans_date"] <= pd.to_datetime(end_date)]

    # 依作物代號過濾
    if crop_code:
        if isinstance(crop_code, list):
            df = df[df["crop_code"].isin(crop_code)]
        else:
            df = df[df["crop_code"] == str(crop_code)]

    # 依市場代號過濾
    if market_code:
        if isinstance(market_code, list):
            df = df[df["market_code"].isin(market_code)]
        else:
            df = df[df["market_code"] == str(market_code)]

    return df.sort_values(["trans_date", "crop_code", "market_code"]).reset_index(drop=True)

