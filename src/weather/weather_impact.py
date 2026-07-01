"""
模組名稱: src.weather.weather_impact
功能說明: 分析產地近期天氣是否異常，解釋現在價格偏貴或偏便宜的原因。

邏輯：
  1. 查品項的主要產地縣市（product_origin_mapping.csv）
  2. 讀取產地「14 天前 ~ 今天」的歷史天氣
  3. 判斷累積降雨量或最高氣溫是否偏離過去 30 天均值 ±30% 以上
  4. 回傳結構化說明：天氣事件 + 預期漲跌方向 + 農民建議

lag 固定 14 天（作物從田間受影響到批發市場約需 1~2 週）。

【相關元件 (Related Components)】
- 依賴: src.data.weather_loader.load_weather_history
- 依賴: src.data.data_loader.load_product_origins
- 被依賴: src.recommendation.purchase_advisor
- 被依賴: backend.main（/api/weather-summary）
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from src.data.data_loader import load_product_origins
from src.data.weather_loader import load_weather_history

LAG_DAYS = 14          # 天氣影響到市場價格的延遲天數
LOOKBACK_DAYS = 30     # 用多少天的資料算「正常基準」
ANOMALY_THRESHOLD = 0.30  # 偏離基準 30% 以上視為異常


# ── 內部工具 ────────────────────────────────────────────────────────────────


def _get_origins(product_name: str, mappings: pd.DataFrame | None = None) -> list[str]:
    """回傳品項的主要產地縣市清單，查不到回傳空清單。"""
    df = load_product_origins() if mappings is None else mappings
    row = df[df["product_name"] == product_name]
    if row.empty:
        return []
    return [c.strip() for c in str(row.iloc[0]["main_origins"]).split(";")]


def _weighted_counties(product_name: str, mappings: pd.DataFrame | None = None) -> list[tuple[str, float]]:
    """回傳 [(縣市, 比重), ...] 排序由高到低。"""
    df = load_product_origins() if mappings is None else mappings
    row = df[df["product_name"] == product_name]
    if row.empty:
        return []
    origins = [c.strip() for c in str(row.iloc[0]["main_origins"]).split(";")]
    weights_raw = str(row.iloc[0]["origin_weight"]).split(";")
    try:
        weights = [float(w) for w in weights_raw]
    except ValueError:
        weights = [1.0 / len(origins)] * len(origins)
    total = sum(weights)
    pairs = [(c, w / total) for c, w in zip(origins, weights)]
    return sorted(pairs, key=lambda x: x[1], reverse=True)


def _analyze_county(
    county: str,
    weather: pd.DataFrame,
    today: date,
) -> dict | None:
    """
    分析單一縣市的天氣是否異常。
    回傳 None 表示資料不足，否則回傳分析結果 dict。
    """
    df = weather[weather["county"] == county].copy()
    if df.empty:
        return None

    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.date
    df = df.sort_values("obs_date")

    impact_end = today - timedelta(days=1)           # 昨天（今天資料可能不完整）
    impact_start = impact_end - timedelta(days=LAG_DAYS - 1)
    # baseline 在 impact 之前，不重疊，避免大雨事件把基準拉高
    baseline_end = impact_start - timedelta(days=1)
    baseline_start = baseline_end - timedelta(days=LOOKBACK_DAYS - 1)

    # 基準期：impact 之前的 30 天
    baseline = df[
        (df["obs_date"] >= baseline_start) & (df["obs_date"] <= baseline_end)
    ]
    # 影響期：最近 14 天
    impact = df[
        (df["obs_date"] >= impact_start) & (df["obs_date"] <= impact_end)
    ]

    if len(baseline) < 5 or len(impact) < 3:
        return None  # 資料太少，不分析

    # ── 降雨分析 ──────────────────────────────────────────────────────
    baseline_rain_daily_avg = baseline["precipitation"].mean()
    impact_rain_total = impact["precipitation"].sum()
    impact_rain_daily_avg = impact["precipitation"].mean()
    impact_rain_days = (impact["precipitation"] > 5).sum()  # 有效降雨天數（>5mm）

    # 基準日均雨量 × LAG_DAYS 推算「正常 14 天累積量」
    expected_rain = baseline_rain_daily_avg * LAG_DAYS
    rain_ratio = (
        (impact_rain_total - expected_rain) / (expected_rain + 1)  # +1 避免除零
    )

    # ── 溫度分析 ──────────────────────────────────────────────────────
    baseline_avg_temp = baseline["avg_temp"].mean()
    impact_avg_temp = impact["avg_temp"].mean()
    temp_diff = impact_avg_temp - baseline_avg_temp if pd.notna(impact_avg_temp) else 0.0
    high_heat_days = (impact["max_temp"] > 35).sum()  # 高溫天數

    # ── 判斷異常類型 ──────────────────────────────────────────────────
    events = []

    # 兩個條件任一成立即視為多雨異常：
    #   1. 相對基準偏高 30% 以上
    #   2. 14 天累積超過 200mm（梅雨/颱風絕對高值）
    heavy_rain = rain_ratio >= ANOMALY_THRESHOLD or impact_rain_total >= 200
    if heavy_rain:
        events.append({
            "type": "heavy_rain",
            "direction": "up",          # 供應減少，價格傾向上漲
            "detail": {
                "rain_total_mm": round(impact_rain_total, 1),
                "rain_days": int(impact_rain_days),
                "vs_normal_pct": round(rain_ratio * 100),
            },
        })
    elif rain_ratio <= -ANOMALY_THRESHOLD and impact_rain_total < 10:
        events.append({
            "type": "drought",
            "direction": "up",          # 乾旱同樣傷作物
            "detail": {
                "rain_total_mm": round(impact_rain_total, 1),
                "vs_normal_pct": round(rain_ratio * 100),
            },
        })

    if high_heat_days >= 3:
        events.append({
            "type": "high_heat",
            "direction": "up",          # 高溫加速老化，品質下降
            "detail": {
                "high_heat_days": int(high_heat_days),
                "avg_temp": round(float(impact_avg_temp), 1) if pd.notna(impact_avg_temp) else None,
            },
        })
    elif temp_diff <= -3:
        events.append({
            "type": "cold_snap",
            "direction": "down",        # 冷涼有利葉菜，供應充足
            "detail": {
                "temp_drop_c": round(abs(temp_diff), 1),
                "avg_temp": round(float(impact_avg_temp), 1) if pd.notna(impact_avg_temp) else None,
            },
        })

    return {
        "county": county,
        "events": events,
        "impact_period": {
            "from": str(impact_start),
            "to": str(impact_end),
        },
        "data_days": len(impact),
    }


def _build_human_text(county: str, events: list[dict]) -> tuple[str, str]:
    """
    根據事件清單生成給農民看的說明。
    回傳 (weather_event_text, farmer_advice_text)
    """
    if not events:
        return "", ""

    texts = []
    advice_parts = []

    for ev in events:
        t = ev["type"]
        d = ev["detail"]
        if t == "heavy_rain":
            days = d["rain_days"]
            total = d["rain_total_mm"]
            pct = d["vs_normal_pct"]
            if pct > 0:
                rain_desc = f"比正常多 {pct}%"
            else:
                rain_desc = f"達 {total} mm（超過警戒量）"
            texts.append(f"{county}產地近 {LAG_DAYS} 天累積降雨 {total} mm，{rain_desc}，有效降雨 {days} 天")
            advice_parts.append("雨後採收品質參差，建議觀望 7–10 天，等市場供應穩定再出貨")
        elif t == "drought":
            total = d["rain_total_mm"]
            texts.append(f"{county}產地近 {LAG_DAYS} 天降雨偏少（累積僅 {total} mm），乾旱可能影響作物生長")
            advice_parts.append("乾旱持續可能造成品質下降，建議加強灌溉並密切注意後續行情")
        elif t == "high_heat":
            days = d["high_heat_days"]
            temp = d.get("avg_temp")
            temp_str = f"，均溫 {temp}°C" if temp else ""
            texts.append(f"{county}產地近 {LAG_DAYS} 天出現 {days} 天高溫（超過 35°C）{temp_str}")
            advice_parts.append("高溫加速老化，葉菜類品質下降，建議少量多批出貨，避免集中採收")
        elif t == "cold_snap":
            drop = d["temp_drop_c"]
            texts.append(f"{county}產地近 {LAG_DAYS} 天氣溫偏低（比正常低 {drop}°C）")
            advice_parts.append("冷涼氣候有利葉菜生長，供應量可能增加，短期價格可能回落")

    weather_text = "；".join(texts)
    farmer_advice = advice_parts[0] if advice_parts else ""
    return weather_text, farmer_advice


# ── 公開 API ────────────────────────────────────────────────────────────────


def get_weather_impact(
    product_name: str,
    mappings: pd.DataFrame | None = None,
    weather: pd.DataFrame | None = None,
    today: date | None = None,
) -> dict:
    """
    分析指定品項的產地天氣對價格的影響。

    回傳結構：
    {
        "product_name": str,
        "has_impact": bool,
        "overall_direction": "up" | "down" | "neutral" | "unknown",
        "affected_counties": [str],
        "weather_event": str,       # 給農民看的天氣事件說明
        "farmer_advice": str,       # 農民建議
        "county_details": [...]     # 各縣市詳情
    }
    """
    today = today or date.today()
    county_weights = _weighted_counties(product_name, mappings)

    if not county_weights:
        return {
            "product_name": product_name,
            "has_impact": False,
            "overall_direction": "unknown",
            "affected_counties": [],
            "weather_event": "",
            "farmer_advice": "",
            "county_details": [],
            "note": "尚未建立此品項的產地資料",
        }

    counties = [c for c, _ in county_weights]
    w_df = load_weather_history(counties=counties) if weather is None else weather

    county_results = []
    weighted_direction_score = 0.0  # +1=漲, -1=跌, 加權後判斷整體方向

    all_counties: list[dict] = []
    for county, weight in county_weights:
        result = _analyze_county(county, w_df, today)
        if result is None:
            all_counties.append({"county": county, "weight": round(weight, 3), "events": [], "no_data": True})
            continue

        result["weight"] = round(weight, 3)
        result["no_data"] = False
        all_counties.append(result)
        if result["events"]:
            county_results.append(result)
            for ev in result["events"]:
                score = weight if ev["direction"] == "up" else -weight
                weighted_direction_score += score

    # 整體方向
    if not county_results:
        overall_direction = "neutral"
    elif weighted_direction_score > 0.15:
        overall_direction = "up"
    elif weighted_direction_score < -0.15:
        overall_direction = "down"
    else:
        overall_direction = "neutral"

    has_impact = bool(county_results)
    affected_counties = [r["county"] for r in county_results]

    # 生成人類可讀文字：取比重最高且有事件的縣市
    weather_text, farmer_advice = "", ""
    if county_results:
        top = county_results[0]
        weather_text, farmer_advice = _build_human_text(top["county"], top["events"])

    return {
        "product_name": product_name,
        "has_impact": has_impact,
        "overall_direction": overall_direction,
        "affected_counties": affected_counties,
        "weather_event": weather_text,
        "farmer_advice": farmer_advice,
        "county_details": county_results,
        "all_counties": all_counties,
    }


def get_weather_summary(
    mappings: pd.DataFrame | None = None,
    weather: pd.DataFrame | None = None,
    today: date | None = None,
) -> list[dict]:
    """
    回傳目前各縣市的天氣異常事件摘要，供頂部警示橫幅使用。
    以「縣市 × 事件類型」去重，避免 132 個品項全部列出。
    每個縣市只取最嚴重的一個事件。
    """
    today = today or date.today()
    w_df = load_weather_history() if weather is None else weather
    df_map = load_product_origins() if mappings is None else mappings

    # 取所有出現在 mapping 的縣市
    all_counties: set[str] = set()
    for origins_str in df_map["main_origins"]:
        for c in str(origins_str).split(";"):
            all_counties.add(c.strip())

    seen_counties: set[str] = set()
    alerts = []

    for county in sorted(all_counties):
        if county in seen_counties:
            continue
        county_df = w_df[w_df["county"] == county]
        if county_df.empty:
            continue

        # 借用 _analyze_county 取得事件清單
        result = _analyze_county(county, w_df, today)
        if result is None or not result["events"]:
            continue

        # 只回傳漲價風險事件
        up_events = [e for e in result["events"] if e["direction"] == "up"]
        if not up_events:
            continue

        ev = up_events[0]
        weather_text, farmer_advice = _build_human_text(county, [ev])

        alerts.append({
            "county": county,
            "event_type": ev["type"],
            "weather_event": weather_text,
            "farmer_advice": farmer_advice,
        })
        seen_counties.add(county)

    return alerts
