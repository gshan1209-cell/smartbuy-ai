from __future__ import annotations
import datetime
import logging
import statistics
import threading
import time

from sqlalchemy import text
from src.anomaly.price_status import get_all_price_statuses
from src.data.price_repository import get_db_engine, get_latest_trans_date, load_price_history

logger = logging.getLogger(__name__)

price_cache: dict = {}

# The demo catalog is intentionally small, but its rows must remain live.  The
# process can stay alive across the daily database job, so a startup-only cache
# would keep yesterday's prices forever.  Check the source date periodically
# and reload when a new trading day is available; also reload periodically in
# case the current day's upsert was corrected without changing MAX(trans_date).
PRICE_CACHE_SOURCE_CHECK_SECONDS = 60
PRICE_CACHE_REFRESH_SECONDS = 5 * 60
_price_cache_lock = threading.Lock()


def _frame_latest_date(prices) -> str | None:
    """Return the latest date represented by a price frame, if available."""
    if prices is None or getattr(prices, "empty", True):
        return None
    reference_date = getattr(prices, "attrs", {}).get("reference_date")
    if reference_date:
        return str(reference_date)[:10]
    if "trans_date" not in prices.columns:
        return None
    latest = prices["trans_date"].max()
    if latest is None:
        return None
    return latest.strftime("%Y-%m-%d") if hasattr(latest, "strftime") else str(latest)[:10]


def _store_price_cache(prices) -> None:
    """Store live prices and the metadata required for refresh decisions."""
    price_cache["prices"] = prices
    price_cache["prices_latest_date"] = _frame_latest_date(prices)
    price_cache["prices_source"] = getattr(prices, "attrs", {}).get("source")
    price_cache["prices_loaded_at"] = time.monotonic()
    price_cache["prices_source_checked_at"] = price_cache["prices_loaded_at"]


def _reload_price_cache(*, force: bool = False):
    """Load live prices and derived summaries as one cache update."""
    with _price_cache_lock:
        prices = load_price_history(days=30)
        _store_price_cache(prices)
        price_cache["all_statuses"] = get_all_price_statuses(prices=prices)
        price_cache["market_intel"] = compute_market_intel()
        if force:
            price_cache["prices_forced_refresh"] = True
        else:
            price_cache.pop("prices_forced_refresh", None)
        return prices


def get_current_prices(*, force: bool = False):
    """Return the demo-filterable price set, refreshing it after DB updates.

    The market/product whitelist is applied by the routers after this function
    returns.  It therefore limits the visible scope without freezing the
    underlying prices to the snapshot loaded when the API process started.
    """
    prices = price_cache.get("prices")
    loaded_at = price_cache.get("prices_loaded_at")
    if prices is None:
        return _reload_price_cache(force=force)

    # Tests and controlled callers may inject an explicit frame.  Such a frame
    # has no live-cache metadata and must not unexpectedly trigger a database
    # connection or overwrite the injected data.
    if loaded_at is None:
        return prices

    now = time.monotonic()
    last_checked = price_cache.get("prices_source_checked_at", loaded_at)
    if not force and now - last_checked < PRICE_CACHE_SOURCE_CHECK_SECONDS:
        if now - loaded_at < PRICE_CACHE_REFRESH_SECONDS:
            return prices

    price_cache["prices_source_checked_at"] = now
    source_probe = get_latest_trans_date()
    if source_probe is None:
        return prices
    latest_source_date, source_name = source_probe
    cached_date = price_cache.get("prices_latest_date") or _frame_latest_date(prices)
    cached_source = price_cache.get("prices_source")
    # A temporary database probe failure can fall back to the local CSV.  Do
    # not replace a good live cache with that fallback just because the probe
    # was unavailable; retry on the next source-check window instead.
    source_is_temporary_fallback = (
        cached_source == "Supabase"
        and source_name == "本機 CSV"
    )
    should_reload = force or (
        not source_is_temporary_fallback
        and (latest_source_date != cached_date or source_name != cached_source)
    )
    if not should_reload and now - loaded_at >= PRICE_CACHE_REFRESH_SECONDS:
        should_reload = True
    return _reload_price_cache(force=force) if should_reload else prices


def preload_market_cache():
    """Initialise the same refreshable cache used by request handlers."""
    return _reload_price_cache(force=True)


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
