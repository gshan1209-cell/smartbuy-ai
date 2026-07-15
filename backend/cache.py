from __future__ import annotations
import datetime
import logging
import statistics

from sqlalchemy import text
from src.data.price_repository import get_db_engine
from src.weather.weather_impact import get_weather_summary

logger = logging.getLogger(__name__)

price_cache: dict = {}


def compute_market_intel() -> dict:
    """
    從 agri_price_features_daily 計算本週市場情報（全台批發市場綜合統計）。
    只取最新交易日、is_feature_complete=TRUE 且 price_std_7>0 的品項。
    """
    engine = get_db_engine()
    if engine is None:
        return {}

    try:
        with engine.connect() as conn:
            sql = text("""
                WITH latest AS (
                    SELECT MAX(trade_date) AS latest_date
                    FROM public.agri_price_features_daily
                    WHERE is_feature_complete = TRUE
                )
                SELECT
                    f.crop_name,
                    f.avg_price,
                    f.price_vs_ma_7,
                    f.price_std_7,
                    f.price_std_14,
                    f.price_return_7,
                    f.volume_vs_ma_7,
                    f.price_ma_7,
                    f.price_ma_14,
                    l.latest_date
                FROM public.agri_price_features_daily f
                JOIN latest l ON f.trade_date = l.latest_date
                WHERE f.is_feature_complete = TRUE
                  AND f.price_std_7 > 0
                  AND f.price_std_14 > 0
            """)
            rows = conn.execute(sql).fetchall()
    except Exception as e:
        logger.exception(e)
        return {}

    if not rows:
        return {}

    latest_date = str(rows[0].latest_date)

    items = []
    for r in rows:
        z = (r.price_vs_ma_7 or 0) / r.price_std_7
        status = "便宜" if z < -1.0 else "偏貴" if z > 1.0 else "正常"
        ret7 = r.price_return_7 or 0
        vol_vs = r.volume_vs_ma_7 or 0
        is_alert = abs(z) > 1.5 and abs(ret7) > 0.15
        severity = ("high" if abs(z) > 2.0 else "medium") if is_alert else None

        divergence = None
        divergence_risk = None
        if ret7 > 0.1 and vol_vs < -0.2:
            divergence, divergence_risk = "量縮價漲", "high"
        elif ret7 < -0.1 and vol_vs > 0.2:
            divergence, divergence_risk = "量增價跌", "high"

        vol_ratio = r.price_std_7 / r.price_std_14

        items.append({
            "crop_name": r.crop_name,
            "today_price": round(r.avg_price, 1) if r.avg_price is not None else None,
            "z_score": round(z, 2),
            "status": status,
            "is_alert": is_alert,
            "severity": severity,
            "price_return_7": round(ret7, 4),
            "divergence": divergence,
            "divergence_risk": divergence_risk,
            "bullish": (r.price_ma_7 or 0) > (r.price_ma_14 or 0),
            "vol_ratio": vol_ratio,
        })

    # B: 漲跌榜
    sorted_ret = sorted(items, key=lambda x: x["price_return_7"], reverse=True)
    gainers = [{"crop_name": i["crop_name"], "price_return_7": i["price_return_7"], "today_price": i["today_price"]}
               for i in sorted_ret[:5]]
    losers = [{"crop_name": i["crop_name"], "price_return_7": i["price_return_7"], "today_price": i["today_price"]}
              for i in sorted_ret[-5:][::-1]]

    # A: 警報
    alerts = []
    for i in items:
        if i["is_alert"]:
            alert = {
                "crop_name": i["crop_name"],
                "today_price": i["today_price"],
                "z_score": i["z_score"],
                "status": i["status"],
                "severity": i["severity"],
                "price_return_7": i["price_return_7"],
            }
            if i["divergence"]:
                alert["divergence"] = i["divergence"]
                alert["divergence_risk"] = i["divergence_risk"]
            alerts.append(alert)
    alerts.sort(key=lambda x: abs(x["z_score"]), reverse=True)

    # E: 市場穩定度
    z_abs = [abs(i["z_score"]) for i in items]
    risk_index = round(statistics.mean(z_abs), 2) if z_abs else 0.0
    risk_level = "高風險" if risk_index > 1.5 else "中風險" if risk_index > 1.0 else "低風險"
    by_vol = sorted(items, key=lambda x: x["vol_ratio"], reverse=True)
    volatile_crops = [i["crop_name"] for i in by_vol if i["vol_ratio"] > 1.3][:5]
    stable_crops = [i["crop_name"] for i in reversed(by_vol) if i["vol_ratio"] < 0.7][:5]

    # G: 均線多空
    bullish_count = sum(1 for i in items if i["bullish"])
    bearish_count = sum(1 for i in items if not i["bullish"])
    if bullish_count > bearish_count * 1.5:
        bias = "偏多"
    elif bearish_count > bullish_count * 1.5:
        bias = "偏空"
    else:
        bias = "中性"
    top_bullish = [i["crop_name"] for i in sorted_ret if i["bullish"]][:3]
    top_bearish = [i["crop_name"] for i in reversed(sorted_ret) if not i["bullish"]][:3]

    return {
        "generated_at": str(datetime.date.today()),
        "latest_trade_date": latest_date,
        "market_stability": {
            "risk_index": risk_index,
            "risk_level": risk_level,
            "volatile_crops": volatile_crops,
            "stable_crops": stable_crops,
        },
        "market_bias": {
            "bullish_count": bullish_count,
            "bearish_count": bearish_count,
            "bias": bias,
            "top_bullish": top_bullish,
            "top_bearish": top_bearish,
        },
        "gainers": gainers,
        "losers": losers,
        "alerts": alerts,
    }


def build_product_weather_risks() -> dict[str, str]:
    """product_name → event_type，啟動時預算，供列表 API 注入。"""
    from src.data.data_loader import load_product_origins
    summary = get_weather_summary()
    if not summary:
        return {}
    alert_counties = {item["county"]: item["event_type"] for item in summary}
    df = load_product_origins()
    risks: dict[str, str] = {}
    for _, row in df.iterrows():
        name = row["product_name"]
        for county in str(row["main_origins"]).split(";"):
            county = county.strip()
            if county in alert_counties:
                risks[name] = alert_counties[county]
                break
    return risks
