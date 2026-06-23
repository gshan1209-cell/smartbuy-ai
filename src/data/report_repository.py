# -*- coding: utf-8 -*-
"""
模組名稱: src.data.report_repository
功能說明: 買貴通報儲存庫，處理通報資料寫入 Supabase，失敗時自動安全 fallback 到本機 CSV。

【相關元件 (Related Components)】
- 依賴: src.anomaly.price_status.get_price_status
- 依賴: src.data.price_repository._load_database_url
"""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from uuid import uuid4
from sqlalchemy import create_engine, text

from src.anomaly.price_status import get_price_status
from src.data.price_repository import _load_database_url

REPORTS_PATH = Path(__file__).resolve().parents[2] / "data/reports/price_reports.csv"

FIELDS = [
    "report_id",
    "report_date",
    "product_name",
    "user_price",
    "unit",
    "market_name",
    "photo_path",
    "official_avg_price",
    "price_gap_rate",
    "status",
]


def classify_price_gap(gap_rate: float | None) -> str:
    if gap_rate is None:
        return "暫無官方行情可比對"
    if gap_rate <= 0.10:
        return "接近行情"
    if gap_rate <= 0.30:
        return "稍高"
    return "可能買貴"


def add_price_report(
    product_name: str,
    user_price: float,
    market_name: str,
    unit: str = "元/公斤",
    path: Path | None = None,
) -> dict:
    if user_price <= 0:
        raise ValueError("買入價格必須大於 0")

    official = get_price_status(product_name).get("today_price")
    
    # 計算價差與價差百分比
    if official is not None:
        official_val = float(official)
        price_gap = float(user_price) - official_val
        gap_rate = price_gap / official_val
        gap_rate_val = round(gap_rate, 4)
    else:
        official_val = None
        price_gap = None
        gap_rate = None
        gap_rate_val = None

    report_id = f"R-{uuid4().hex[:8].upper()}"
    report_date_str = date.today().isoformat()

    # 1. 嘗試寫入 Supabase
    database_url = _load_database_url()
    if database_url:
        try:
            engine = create_engine(database_url, pool_pre_ping=True)
            with engine.begin() as conn:
                sql = text(
                    """
                    INSERT INTO price_reports (
                        report_id, report_date, crop_name, product_name, market_name, 
                        user_price, unit, reference_price, price_gap, price_gap_percent, 
                        report_note, write_destination
                    ) VALUES (
                        :report_id, :report_date, :crop_name, :product_name, :market_name, 
                        :user_price, :unit, :reference_price, :price_gap, :price_gap_percent, 
                        :report_note, :write_destination
                    );
                    """
                )
                conn.execute(
                    sql,
                    {
                        "report_id": report_id,
                        "report_date": date.today(),
                        "crop_name": product_name,
                        "product_name": product_name,
                        "market_name": market_name.strip(),
                        "user_price": round(float(user_price), 2),
                        "unit": unit,
                        "reference_price": official_val,
                        "price_gap": price_gap,
                        "price_gap_percent": gap_rate_val,
                        "report_note": "待確認",
                        "write_destination": "Supabase",
                    },
                )
            
            return {
                "report_id": report_id,
                "report_date": report_date_str,
                "product_name": product_name,
                "user_price": round(float(user_price), 2),
                "unit": unit,
                "market_name": market_name.strip(),
                "photo_path": "",
                "official_avg_price": official if official is not None else "",
                "price_gap_rate": "" if gap_rate_val is None else gap_rate_val,
                "status": "待確認",
                "write_destination": "Supabase",
                "comparison": classify_price_gap(gap_rate)
            }
        except Exception as e:
            print(f"寫入 Supabase 失敗，將 fallback 到本機 CSV。錯誤: {e}")

    # 2. Fallback to local CSV
    target = path or REPORTS_PATH
    row = {
        "report_id": report_id,
        "report_date": report_date_str,
        "product_name": product_name,
        "user_price": round(float(user_price), 2),
        "unit": unit,
        "market_name": market_name.strip(),
        "photo_path": "",
        "official_avg_price": official if official is not None else "",
        "price_gap_rate": "" if gap_rate_val is None else gap_rate_val,
        "status": "待確認",
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not target.exists() or target.stat().st_size == 0
    with target.open("a", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if needs_header:
            writer.writeheader()
        writer.writerow(row)

    return {
        **row,
        "write_destination": "本機 CSV",
        "comparison": classify_price_gap(gap_rate)
    }
