from fastapi import APIRouter, HTTPException, Query

from backend.cache import compute_market_intel, get_current_prices, price_cache
from src.recommendation.category_catalog import (
    UnknownRecommendationCategory,
    get_category,
    market_matches_region,
)
from backend.demo_catalog import demo_market_names

router = APIRouter()


@router.get("/api/markets")
def list_markets(
    category: str | None = Query(default=None, max_length=64),
    region: str | None = Query(default=None, max_length=32),
):
    if not category and not region:
        return {"markets": demo_market_names()}

    category_definition = None
    if category:
        try:
            category_definition = get_category(category)
        except UnknownRecommendationCategory as exc:
            # Reject invalid filters before touching the live data source.
            raise HTTPException(status_code=422, detail="不支援的推薦分類。") from exc

    # Keep the fixed demo market scope, but always let the underlying rows
    # follow the latest database trading day for data-dependent filters.
    prices = get_current_prices()
    if category_definition:
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
    available = set(prices["market_name"].dropna().unique().tolist())
    markets = [name for name in demo_market_names() if name in available]
    return {"markets": markets}


@router.get("/api/market-intel")
def market_intel():
    get_current_prices()
    data = price_cache.get("market_intel")
    if data is None:
        data = compute_market_intel()
    return data
