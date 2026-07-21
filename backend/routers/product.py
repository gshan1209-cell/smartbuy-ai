from __future__ import annotations
import math
import logging

import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import text

from backend.cache import price_cache
from src.data.price_repository import load_price_history, get_db_engine, get_latest_crop_features
from src.anomaly.price_status import get_all_price_statuses
from src.recommendation.purchase_advisor import get_purchase_advice
from src.ml.direction_predictor import predict_direction

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/products")
def list_products(q: str = Query(default=""), market: str = Query(default="")):
    if market:
        all_statuses = get_all_price_statuses(prices=price_cache.get("prices"), market_name=market)
    else:
        all_statuses = price_cache.get("all_statuses") or get_all_price_statuses()
    if q.strip():
        all_statuses = [s for s in all_statuses if q.strip() in s["product_name"]]
    return all_statuses


@router.get("/api/products/{name}/direction")
def get_product_direction(name: str, market: str = Query(default="")):
    """回傳指定品項明天的漲跌方向預測（LightGBM v2）。"""
    df = load_price_history(crop_name=name, market_name=market or None, days=60)
    if df.empty:
        raise HTTPException(status_code=404, detail="查無此品項歷史資料")
    return predict_direction(df, crop_name=name, market_name=market or "")


@router.get("/api/products/{name}/history")
def get_product_history(name: str, days: int = Query(default=30), market: str = Query(default="")):
    df = load_price_history(crop_name=name, market_name=market or None, days=days)
    if df.empty:
        return {"history": []}
    df["trans_date"] = pd.to_datetime(df["trans_date"]).dt.strftime("%Y-%m-%d")

    agg_spec: dict = {"avg_price": "mean"}
    for col in ("upper_price", "lower_price"):
        if col in df.columns:
            agg_spec[col] = "mean"
    if "volume" in df.columns:
        agg_spec["volume"] = "sum"

    agg = (
        df.groupby("trans_date")
        .agg(agg_spec)
        .reset_index()
        .rename(columns={"trans_date": "date", "avg_price": "price"})
    )
    agg["price"] = agg["price"].round(1)
    for col in ("upper_price", "lower_price"):
        if col in agg.columns:
            agg[col] = agg[col].round(1)
    if "volume" in agg.columns:
        agg["volume"] = agg["volume"].round(0)

    # 從 agri_price_features_daily JOIN 預計算特徵
    feature_cols = ("price_ma_7", "price_ma_14", "price_ma_30", "price_std_7", "price_vs_ma_7", "price_return_7")
    try:
        engine = get_db_engine()
        if engine is not None and len(agg) > 0:
            start_date = agg["date"].min()
            mkt = market or ""
            with engine.connect() as conn:
                sql = text("""
                    SELECT trade_date::text AS date,
                           AVG(price_ma_7)    AS price_ma_7,
                           AVG(price_ma_14)   AS price_ma_14,
                           AVG(price_ma_30)   AS price_ma_30,
                           AVG(price_std_7)   AS price_std_7,
                           AVG(price_vs_ma_7) AS price_vs_ma_7,
                           AVG(price_return_7) AS price_return_7
                    FROM public.agri_price_features_daily
                    WHERE crop_name = :crop_name
                      AND trade_date >= :start_date
                      AND (:market_name = '' OR market_name = :market_name)
                    GROUP BY trade_date
                """)
                feat_rows = conn.execute(sql, {
                    "crop_name": name,
                    "start_date": start_date,
                    "market_name": mkt,
                }).fetchall()
            if feat_rows:
                feat_df = pd.DataFrame([dict(r._mapping) for r in feat_rows])
                for col in ("price_ma_7", "price_ma_14", "price_ma_30"):
                    if col in feat_df.columns:
                        feat_df[col] = feat_df[col].round(1)
                for col in ("price_std_7", "price_vs_ma_7", "price_return_7"):
                    if col in feat_df.columns:
                        feat_df[col] = feat_df[col].round(4)
                agg = agg.merge(feat_df, on="date", how="left")
    except Exception as e:
        logger.exception(e)

    for col in feature_cols:
        if col not in agg.columns:
            agg[col] = None

    import math as _math
    raw = agg.to_dict(orient="records")
    rows = [
        {k: (None if isinstance(v, float) and not _math.isfinite(v) else v)
         for k, v in rec.items()}
        for rec in raw
    ]
    return {"history": rows}


@router.get("/api/products/{name}")
def get_product_detail(name: str, market: str = Query(default="")):
    result = get_purchase_advice(name, prices=price_cache.get("prices"), market_name=market or None)
    if result["price_detail"]["status"] == "資料不足" and not result["today_price"]:
        raise HTTPException(status_code=404, detail="查無此品項資料")

    # 附加 z_score 與 MA 欄位（從 agri_price_features_daily 取最新一筆）
    result["z_score"] = None
    result["price_vs_ma_7"] = None
    result["price_ma_7"] = None
    result["price_ma_14"] = None
    result["price_ma_30"] = None
    try:
        feat = get_latest_crop_features(name, market_name=market or "")
        if feat:
            result["price_vs_ma_7"] = round(feat["price_vs_ma_7"], 4) if feat["price_vs_ma_7"] is not None else None
            result["price_ma_7"]    = round(feat["price_ma_7"], 1)    if feat["price_ma_7"]    is not None else None
            result["price_ma_14"]   = round(feat["price_ma_14"], 1)   if feat["price_ma_14"]   is not None else None
            result["price_ma_30"]   = round(feat["price_ma_30"], 1)   if feat["price_ma_30"]   is not None else None
            if feat["price_std_7"] and feat["price_std_7"] > 0 and feat["price_vs_ma_7"] is not None:
                result["z_score"] = round(feat["price_vs_ma_7"] / feat["price_std_7"], 2)
    except Exception as e:
        logger.exception(e)

    return result
