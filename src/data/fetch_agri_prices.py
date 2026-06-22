"""
模組名稱: src.data.fetch_agri_prices
功能說明: 抓取農業部農產品交易行情資料，並整理成 agri_price_daily 對應欄位。
"""

from __future__ import annotations

from datetime import date
from typing import Any

import os

import certifi
import urllib3
from urllib3.exceptions import InsecureRequestWarning

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import pandas as pd
import requests


API_URL = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx"


COLUMN_ALIASES = {
    "trans_date": ["交易日期", "TransDate", "trans_date"],
    "crop_code": ["作物代號", "CropCode", "crop_code"],
    "crop_name": ["作物名稱", "CropName", "crop_name"],
    "market_code": ["市場代號", "MarketCode", "market_code"],
    "market_name": ["市場名稱", "MarketName", "market_name"],
    "upper_price": ["上價(元/公斤)", "上價", "Upper_Price", "upper_price"],
    "middle_price": ["中價(元/公斤)", "中價", "Middle_Price", "middle_price"],
    "lower_price": ["下價(元/公斤)", "下價", "Lower_Price", "lower_price"],
    "avg_price": ["平均價(元/公斤)", "平均價", "Avg_Price", "avg_price"],
    "volume": ["交易量(公斤)", "交易量", "Trans_Quantity", "volume"],
}

def _build_retry_session() -> requests.Session:
    """
    建立具備 retry 機制的 requests session。

    目的：
    - 避免 GitHub Actions 因農業部 API 偶發 timeout 直接失敗
    - 遇到 429 / 500 / 502 / 503 / 504 時自動重試
    """
    max_retries = int(os.getenv("SMARTBUY_API_MAX_RETRIES", "5"))

    retry_strategy = Retry(
        total=max_retries,
        connect=max_retries,
        read=max_retries,
        status=max_retries,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)

    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    return session

def _get_value(row: dict[str, Any], aliases: list[str]) -> Any:
    """依照可能的欄位名稱，從 API row 中取值。"""
    for name in aliases:
        if name in row:
            return row.get(name)
    return None


def _parse_number(value: Any) -> float | None:
    """將價格、交易量轉成數字。"""
    if value is None:
        return None

    text = str(value).strip().replace(",", "")

    if text in {"", "-", "—", "None", "null"}:
        return None

    try:
        return float(text)
    except ValueError:
        return None


def _parse_trans_date(value: Any) -> date | None:
    """
    轉換交易日期。

    農業資料有可能出現：
    - 西元：2026-06-22
    - 民國：115.06.22
    - 民國：115/06/22
    """
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    text = text.replace("/", ".").replace("-", ".")

    parts = text.split(".")

    if len(parts) != 3:
        return None

    try:
        year = int(parts[0])
        month = int(parts[1])
        day = int(parts[2])

        # 民國年轉西元年
        if year < 1911:
            year += 1911

        return date(year, month, day)

    except ValueError:
        return None


def fetch_agri_prices() -> pd.DataFrame:
    """
    抓取農產品交易行情資料，整理成 agri_price_daily 可寫入格式。
    """
    allow_insecure_ssl = (
        os.getenv("SMARTBUY_ALLOW_INSECURE_SSL", "false").lower() == "true"
    )

    headers = {
        "User-Agent": "SmartBuy-AI-MVP/0.1"
    }

    if allow_insecure_ssl:
        urllib3.disable_warnings(InsecureRequestWarning)

    connect_timeout = int(os.getenv("SMARTBUY_API_CONNECT_TIMEOUT", "30"))
    read_timeout = int(os.getenv("SMARTBUY_API_READ_TIMEOUT", "180"))

    session = _build_retry_session()

    response = session.get(
        API_URL,
        timeout=(connect_timeout, read_timeout),
        headers=headers,
        verify=False if allow_insecure_ssl else certifi.where(),
    )
    response.raise_for_status()

    data = response.json()

    if isinstance(data, dict):
        # 預防 API 外層包成 {"Data": [...]} 或類似格式
        for key in ["Data", "data", "records", "result"]:
            if key in data and isinstance(data[key], list):
                data = data[key]
                break

    if not isinstance(data, list):
        raise ValueError("API 回傳格式不是 list，請檢查農業部 API 回傳內容。")

    rows: list[dict[str, Any]] = []

    for item in data:
        if not isinstance(item, dict):
            continue

        row = {
            "trans_date": _parse_trans_date(
                _get_value(item, COLUMN_ALIASES["trans_date"])
            ),
            "crop_code": str(
                _get_value(item, COLUMN_ALIASES["crop_code"]) or ""
            ).strip(),
            "crop_name": str(
                _get_value(item, COLUMN_ALIASES["crop_name"]) or ""
            ).strip(),
            "market_code": str(
                _get_value(item, COLUMN_ALIASES["market_code"]) or ""
            ).strip(),
            "market_name": str(
                _get_value(item, COLUMN_ALIASES["market_name"]) or ""
            ).strip(),
            "upper_price": _parse_number(
                _get_value(item, COLUMN_ALIASES["upper_price"])
            ),
            "middle_price": _parse_number(
                _get_value(item, COLUMN_ALIASES["middle_price"])
            ),
            "lower_price": _parse_number(
                _get_value(item, COLUMN_ALIASES["lower_price"])
            ),
            "avg_price": _parse_number(
                _get_value(item, COLUMN_ALIASES["avg_price"])
            ),
            "volume": _parse_number(
                _get_value(item, COLUMN_ALIASES["volume"])
            ),
        }

        # 基本欄位不足就略過
        if not row["trans_date"]:
            continue

        if not row["crop_name"]:
            continue

        if not row["market_name"]:
            continue

        rows.append(row)

    df = pd.DataFrame(rows)

    if df.empty:
        return df

    df = df.drop_duplicates(
        subset=["trans_date", "crop_code", "market_code"],
        keep="last"
    )

    return df


if __name__ == "__main__":
    df_preview = fetch_agri_prices()
    print(f"抓到資料筆數：{len(df_preview)}")
    print(df_preview.head(10))