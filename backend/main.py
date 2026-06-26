"""
SmartBuy AI — FastAPI 後端
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from contextlib import asynccontextmanager

from src.recommendation.purchase_advisor import get_bargain_recommendations, get_purchase_advice
from src.calendar.solar_terms import get_today_solar_term_advice
from src.weather.typhoon_alert import get_typhoon_alert
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.anomaly.price_status import get_price_status, get_all_price_statuses
from src.data.price_repository import load_latest_prices, load_price_history

_price_cache: dict = {}


@asynccontextmanager
async def lifespan(app):
    # 啟動時預載 30 天價格資料，避免第一次 request 才查 DB
    _price_cache["prices"] = load_price_history(days=30)
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 首頁 ──────────────────────────────────────────────────────────────────────

@app.get("/api/home")
def home():
    typhoon = get_typhoon_alert()
    recommendations = get_bargain_recommendations(prices=_price_cache.get("prices"))
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

@app.get("/api/products")
def list_products(q: str = Query(default="")):
    all_statuses = get_all_price_statuses(prices=_price_cache.get("prices"))
    if q.strip():
        all_statuses = [s for s in all_statuses if q.strip() in s["product_name"]]
    return all_statuses


@app.get("/api/products/{name}")
def get_product_detail(name: str):
    result = get_purchase_advice(name)
    if result["price_detail"]["status"] == "資料不足" and not result["today_price"]:
        raise HTTPException(status_code=404, detail="查無此品項資料")
    return result


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
