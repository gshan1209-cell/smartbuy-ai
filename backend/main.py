"""
SmartBuy AI — FastAPI 後端
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contextlib import asynccontextmanager

from src.recommendation.purchase_advisor import get_bargain_recommendations, get_purchase_advice
from src.calendar.solar_terms import get_today_solar_term_advice
from src.weather.typhoon_alert import get_typhoon_alert
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.weather.weather_impact import get_weather_impact, get_weather_summary
from src.anomaly.price_status import get_price_status, get_all_price_statuses
from src.data.price_repository import load_latest_prices, load_price_history
from src.ml.direction_predictor import predict_direction
from src.data.price_direction_prediction_store import query_latest_prediction, query_prediction_list

_price_cache: dict = {}


def _build_product_weather_risks() -> dict[str, str]:
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


@asynccontextmanager
async def lifespan(app):
    prices = load_price_history(days=30)
    _price_cache["prices"] = prices
    _price_cache["all_statuses"] = get_all_price_statuses(prices=prices)
    _price_cache["recommendations"] = get_bargain_recommendations(prices=prices)
    _price_cache["weather_risks"] = _build_product_weather_risks()
    yield
    _price_cache.clear()


app = FastAPI(title="SmartBuy AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "https://smartbuy-ai-react-v4nh.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 首頁 ──────────────────────────────────────────────────────────────────────

@app.get("/api/home")
def home():
    typhoon = get_typhoon_alert()
    recommendations = _price_cache.get("recommendations") or get_bargain_recommendations()
    # 取前三品項的天氣風險
    weather_alerts = []
    seen: set[str] = set()
    for item in recommendations[:3]:
        name = item["product_name"]
        if name not in seen:
            risk = get_origin_weather_risk(name)
            if risk["risk_level"] not in {"低", "資料不足"}:
                weather_alerts.append(risk)
            seen.add(name)
    return {
        "solar_term": get_today_solar_term_advice(),
        "typhoon": typhoon,
        "weather_alerts": weather_alerts,
        "recommendations": recommendations,
    }


# ── 菜價搜尋 ──────────────────────────────────────────────────────────────────

@app.get("/api/markets")
def list_markets():
    prices = _price_cache.get("prices")
    if prices is None:
        prices = load_price_history(days=30)
    markets = sorted(prices["market_name"].dropna().unique().tolist())
    return {"markets": markets}


@app.get("/api/products")
def list_products(q: str = Query(default=""), market: str = Query(default="")):
    if market:
        all_statuses = get_all_price_statuses(prices=_price_cache.get("prices"), market_name=market)
    else:
        all_statuses = _price_cache.get("all_statuses") or get_all_price_statuses()
    if q.strip():
        all_statuses = [s for s in all_statuses if q.strip() in s["product_name"]]
    weather_risks = _price_cache.get("weather_risks", {})
    return [{**s, "weather_risk": weather_risks.get(s["product_name"])} for s in all_statuses]


@app.get("/api/products/{name}/direction")
def get_product_direction(name: str, market: str = Query(default="")):
    """回傳指定品項明天的漲跌方向預測（LightGBM v2）。"""
    df = load_price_history(crop_name=name, market_name=market or None, days=60)
    if df.empty:
        raise HTTPException(status_code=404, detail="查無此品項歷史資料")
    return predict_direction(df, crop_name=name, market_name=market or "")


@app.get("/api/products/{name}/history")
def get_product_history(name: str, days: int = Query(default=30), market: str = Query(default="")):
    df = load_price_history(crop_name=name, market_name=market or None, days=days)
    if df.empty:
        return {"history": []}
    df["trans_date"] = pd.to_datetime(df["trans_date"]).dt.strftime("%Y-%m-%d")
    rows = (
        df.groupby("trans_date")["avg_price"]
        .mean()
        .reset_index()
        .rename(columns={"trans_date": "date", "avg_price": "price"})
        .assign(price=lambda x: x["price"].round(1))
        .to_dict(orient="records")
    )
    return {"history": rows}


@app.get("/api/products/{name}")
def get_product_detail(name: str, market: str = Query(default="")):
    result = get_purchase_advice(name, market_name=market or None)
    if result["price_detail"]["status"] == "資料不足" and not result["today_price"]:
        raise HTTPException(status_code=404, detail="查無此品項資料")
    result["weather_impact"] = get_weather_impact(name)
    return result


# ── 天氣影響摘要 ──────────────────────────────────────────────────────────────

@app.get("/api/weather-summary")
def weather_summary():
    return get_weather_summary()


# ── 節氣指南 ──────────────────────────────────────────────────────────────────

@app.get("/api/solar-term")
def solar_term():
    return get_today_solar_term_advice()


@app.get("/api/solar-term/all")
def all_solar_terms():
    from src.data.data_loader import load_solar_terms
    df = load_solar_terms()
    return df.to_dict(orient="records")


# ── 回報菜價 ──────────────────────────────────────────────────────────────────

class PriceReport(BaseModel):
    product_name: str
    market_name: str
    price: float
    note: str = ""


@app.post("/api/report")
def report_price(payload: PriceReport):
    from src.data.report_store import save_report
    save_report(
        product_name=payload.product_name,
        market_name=payload.market_name,
        price=payload.price,
        note=payload.note,
    )
    return {"success": True, "message": f"已收到 {payload.product_name} 的回報，謝謝！"}


# ── 我的菜籃（瀏覽器端 localStorage，後端僅提供品項清單） ────────────────────

@app.get("/api/predictions/direction/latest")
def get_prediction_latest(
    crop_id: str = Query(default=""),
    market_id: str = Query(default=""),
    crop_name: str = Query(default=""),
    market_name: str = Query(default=""),
):
    """查詢單一市場作物最新每日批次方向預測。"""
    result = query_latest_prediction(
        crop_id=crop_id or None,
        market_id=market_id or None,
        crop_name=crop_name or None,
        market_name=market_name or None,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="查無此品項的每日方向預測")
    return result


@app.get("/api/predictions/direction")
def get_prediction_list(
    market_id: str = Query(default=""),
    direction: str = Query(default=""),
    risk: str = Query(default=""),
    limit: int = Query(default=100, ge=1, le=500),
):
    """查詢多筆每日批次方向預測列表。"""
    return query_prediction_list(
        market_id=market_id or None,
        direction=direction or None,
        risk=risk or None,
        limit=limit,
    )


# ── 我的菜籃（瀏覽器端 localStorage，後端僅提供品項清單） ────────────────────

@app.get("/api/basket/products")
def basket_products():
    """回傳所有可加入菜籃的品項名稱"""
    df = load_latest_prices()
    names = sorted(df["product_name"].unique().tolist())
    return {"products": names}


@app.get("/api/basket/advice")
def basket_advice(items: str = Query(default="")):
    """依逗號分隔的品項清單，逐一回傳採買建議"""
    if not items.strip():
        return []
    names = [n.strip() for n in items.split(",") if n.strip()]
    return [get_purchase_advice(n) for n in names]
