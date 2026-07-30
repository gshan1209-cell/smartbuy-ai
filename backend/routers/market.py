from fastapi import APIRouter

from backend.cache import price_cache, compute_market_intel
from src.data.price_repository import load_price_history

router = APIRouter()


@router.get("/api/markets")
def list_markets():
    prices = price_cache.get("prices")
    if prices is None:
        prices = load_price_history(days=30)
    markets = sorted(prices["market_name"].dropna().unique().tolist())
    return {"markets": markets}


@router.get("/api/market-intel")
def market_intel():
    data = price_cache.get("market_intel")
    if data is None:
        data = compute_market_intel()
    return data
