"""
撈取 CWA 歷史天氣資料（過去 90 天）並存為本地 CSV。

資料集：C-B0024-001（局屬氣象站逐時觀測）
輸出：data/weather/weather_daily.csv

使用方式：
    python scripts/fetch_weather_history.py
    python scripts/fetch_weather_history.py --days 30   # 只撈最近 30 天
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_KEY = "CWA-375FA7EE-5081-429E-BA07-B372D6BAB1ED"
DATASET = "C-B0024-001"
BASE_URL = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{DATASET}"
OUTPUT_PATH = PROJECT_ROOT / "data" / "weather" / "weather_daily.csv"
STATION_MAP_PATH = PROJECT_ROOT / "data" / "mapping" / "county_station_map.json"

# SSL context（CWA 憑證在某些環境需要關閉驗證）
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


def _load_station_map() -> dict[str, dict]:
    """回傳 {county: {station_id, station_name}} mapping"""
    with open(STATION_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)["stations"]


def _target_station_ids(station_map: dict) -> set[str]:
    return {v["station_id"] for v in station_map.values()}


def _fetch_hourly(date_from: date, date_to: date) -> list[dict]:
    """
    從 CWA API 撈指定日期範圍的逐時觀測，回傳所有測站的原始 records。
    date_to 最多到 date_from + 31 天（避免超過 API 限制）。
    """
    params = (
        f"?Authorization={API_KEY}"
        f"&timeFrom={date_from}T00:00:00"
        f"&timeTo={date_to}T23:59:59"
        f"&elementName=AirTemperature,Precipitation"
        f"&limit=1000"
    )
    url = BASE_URL + params
    try:
        with urllib.request.urlopen(url, timeout=30, context=_ssl_ctx) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"  ⚠ API 請求失敗 ({date_from} ~ {date_to}): {e}", file=sys.stderr)
        return []

    if not data.get("success"):
        print(f"  ⚠ API 回傳失敗 ({date_from} ~ {date_to})", file=sys.stderr)
        return []

    return data.get("records", {}).get("location", [])


def _parse_to_daily(locations: list[dict], target_ids: set[str]) -> list[dict]:
    """
    把逐時 records 聚合成日資料。
    回傳: [{obs_date, station_id, station_name, avg_temp, max_temp, min_temp, precipitation}, ...]
    """
    # station_id → date → [hourly_temp], [hourly_precip]
    from collections import defaultdict
    buf: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(
        lambda: {"temps": [], "precips": []}
    ))
    station_names: dict[str, str] = {}

    for loc in locations:
        sid = loc["station"]["StationID"]
        if sid not in target_ids:
            continue
        station_names[sid] = loc["station"]["StationName"]
        for obs in loc.get("stationObsTimes", {}).get("stationObsTime", []):
            dt_str = obs["DateTime"][:10]  # YYYY-MM-DD
            we = obs.get("weatherElements", {})
            try:
                temp = float(we.get("AirTemperature", "X"))
                buf[sid][dt_str]["temps"].append(temp)
            except ValueError:
                pass
            try:
                precip = float(we.get("Precipitation", "0") or "0")
                buf[sid][dt_str]["precips"].append(precip)
            except ValueError:
                pass

    rows = []
    for sid, dates in buf.items():
        for dt_str, vals in sorted(dates.items()):
            temps = vals["temps"]
            precips = vals["precips"]
            rows.append({
                "obs_date": dt_str,
                "station_id": sid,
                "station_name": station_names.get(sid, ""),
                "avg_temp": round(sum(temps) / len(temps), 1) if temps else None,
                "max_temp": round(max(temps), 1) if temps else None,
                "min_temp": round(min(temps), 1) if temps else None,
                "precipitation": round(sum(precips), 1),
            })
    return rows


def fetch(days: int = 90) -> pd.DataFrame:
    station_map = _load_station_map()
    target_ids = _target_station_ids(station_map)

    # 建立「縣市 → station_id」反查表
    county_by_sid = {v["station_id"]: k for k, v in station_map.items()}

    end_date = date.today() - timedelta(days=1)  # 昨天（今天資料可能不完整）
    start_date = end_date - timedelta(days=days - 1)

    all_rows: list[dict] = []

    # 每次最多撈 30 天（避免回傳量太大）
    chunk = timedelta(days=30)
    cursor = start_date
    while cursor <= end_date:
        chunk_end = min(cursor + chunk - timedelta(days=1), end_date)
        print(f"撈取 {cursor} ~ {chunk_end} ...", end=" ", flush=True)
        locations = _fetch_hourly(cursor, chunk_end)
        rows = _parse_to_daily(locations, target_ids)
        print(f"{len(rows)} 筆日資料")
        all_rows.extend(rows)
        cursor = chunk_end + timedelta(days=1)
        if cursor <= end_date:
            time.sleep(0.5)  # 避免打太快

    if not all_rows:
        print("⚠ 沒有撈到任何資料", file=sys.stderr)
        return pd.DataFrame()

    df = pd.DataFrame(all_rows)
    df["county"] = df["station_id"].map(county_by_sid)
    df = df.sort_values(["county", "obs_date"]).reset_index(drop=True)

    # 去重（相同 station + date 保留一筆）
    df = df.drop_duplicates(subset=["station_id", "obs_date"])

    return df


def main():
    parser = argparse.ArgumentParser(description="撈 CWA 歷史天氣資料")
    parser.add_argument("--days", type=int, default=90, help="往回幾天（預設 90）")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH), help="輸出 CSV 路徑")
    args = parser.parse_args()

    print(f"開始撈取最近 {args.days} 天天氣資料...")
    df = fetch(days=args.days)

    if df.empty:
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")

    print(f"\n完成！共 {len(df)} 筆，存至：{output_path}")
    print(f"涵蓋縣市：{sorted(df['county'].dropna().unique().tolist())}")
    print(f"日期範圍：{df['obs_date'].min()} ~ {df['obs_date'].max()}")
    print("\n各縣市資料筆數：")
    print(df.groupby("county")["obs_date"].count().to_string())


if __name__ == "__main__":
    main()
