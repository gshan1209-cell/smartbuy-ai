from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from backend.cache import price_cache
from src.recommendation.purchase_advisor import get_bargain_recommendations, get_purchase_advice
from src.calendar.solar_terms import get_current_solar_term
from src.weather.typhoon_alert import get_typhoon_alert
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.weather.weather_impact import get_weather_summary
from src.data.agri_news_repository import query_agri_news
from src.data.price_repository import load_latest_prices

router = APIRouter()


@router.get("/api/home")
def home():
    typhoon = get_typhoon_alert()
    recommendations = price_cache.get("recommendations") or get_bargain_recommendations()
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
        "solar_term": get_current_solar_term(),
        "typhoon": typhoon,
        "weather_alerts": weather_alerts,
        "recommendations": recommendations,
    }


@router.get("/api/news")
def get_agri_news(
    source: str | None = Query(default=None, max_length=100),
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        source_name = source.strip() if source and source.strip() else None
        rows = query_agri_news(
            source_name=source_name,
            keyword=q,
            limit=limit,
            offset=offset,
        )
        response_fields = [
            "id",
            "article_key",
            "source_name",
            "source_article_id",
            "title",
            "published_date",
            "source_url",
            "content_text",
            "updated_at",
        ]
        return [{key: row.get(key) for key in response_fields} for row in rows]
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="新聞資料暫時無法取得，請稍後再試。",
        )


@router.get("/api/weather-summary")
def weather_summary():
    return get_weather_summary()


@router.get("/api/solar-term")
def solar_term():
    return get_current_solar_term()


class PriceReport(BaseModel):
    product_name: str
    market_name: str
    price: float
    note: str = ""


@router.post("/api/report")
def report_price(payload: PriceReport):
    from src.data.report_store import save_report
    save_report(
        product_name=payload.product_name,
        market_name=payload.market_name,
        price=payload.price,
        note=payload.note,
    )
    return {"success": True, "message": f"已收到 {payload.product_name} 的回報，謝謝！"}


@router.get("/api/basket/products")
def basket_products():
    """回傳所有可加入菜籃的品項名稱"""
    df = load_latest_prices()
    names = sorted(df["product_name"].unique().tolist())
    return {"products": names}


@router.get("/api/basket/advice")
def basket_advice(items: str = Query(default="")):
    """依逗號分隔的品項清單，逐一回傳採買建議"""
    if not items.strip():
        return []
    names = [n.strip() for n in items.split(",") if n.strip()]
    return [get_purchase_advice(n) for n in names]
