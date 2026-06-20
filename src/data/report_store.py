"""
模組名稱: src.data.report_store
功能說明: 買貴通報儲存模組，處理通報資料的寫入與讀取。

【相關元件 (Related Components)】
- 依賴: src.anomaly.price_status.get_price_status
"""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from uuid import uuid4

from src.anomaly.price_status import get_price_status


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
        return "待確認"
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
    target = path or REPORTS_PATH
    official = get_price_status(product_name).get("today_price")
    gap = None if not official else (float(user_price) - float(official)) / float(official)
    row = {
        "report_id": f"R-{uuid4().hex[:8].upper()}",
        "report_date": date.today().isoformat(),
        "product_name": product_name,
        "user_price": round(float(user_price), 2),
        "unit": unit,
        "market_name": market_name.strip(),
        "photo_path": "",
        "official_avg_price": official or "",
        "price_gap_rate": "" if gap is None else round(gap, 4),
        "status": "待確認",
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not target.exists() or target.stat().st_size == 0
    with target.open("a", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if needs_header:
            writer.writeheader()
        writer.writerow(row)
    return {**row, "comparison": classify_price_gap(gap)}

