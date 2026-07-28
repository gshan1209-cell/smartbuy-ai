from fastapi import APIRouter, HTTPException, Query

from backend.cache import price_cache, compute_market_intel
from src.recommendation.category_catalog import (
    UnknownRecommendationCategory,
    get_category,
    market_matches_region,
)
from src.data.price_repository import load_price_history

router = APIRouter()


@router.get("/api/markets")
def list_markets(
    category: str | None = Query(default=None, max_length=64),
    region: str | None = Query(default=None, max_length=32),
):
    prices = price_cache.get("prices")
    if prices is None:
        prices = load_price_history(days=30)
    if category:
        try:
            category_definition = get_category(category)
        except UnknownRecommendationCategory as exc:
            raise HTTPException(status_code=422, detail="不支援的推薦分類。") from exc
        product_column = "product_name" if "product_name" in prices.columns else "crop_name"
        if product_column not in prices.columns:
            prices = prices.iloc[0:0]
        else:
            prices = prices[prices[product_column].fillna("").astype(str).map(category_definition.matches)]
    if region:
        try:
            prices = prices[prices["market_name"].fillna("").astype(str).map(
                lambda market_name: market_matches_region(market_name, region)
            )]
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="不支援的推薦區域。") from exc
    markets = sorted(prices["market_name"].dropna().unique().tolist())
    return {"markets": markets}


@router.get("/api/market-intel")
def market_intel():
    data = price_cache.get("market_intel")
    if data is None:
        data = compute_market_intel()
    return data
