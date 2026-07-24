"""FastAPI 啟動與關閉生命週期。"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.cache import compute_market_intel, price_cache
from backend.routers import agriculture
from src.anomaly.price_status import get_all_price_statuses
from src.data.price_repository import load_price_history


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    """預載常用行情資料，並在關閉時釋放背景工作與快取。"""
    prices = await asyncio.to_thread(lambda: load_price_history(days=30))
    price_cache["prices"] = prices
    price_cache["all_statuses"] = await asyncio.to_thread(
        get_all_price_statuses,
        prices=prices,
    )
    price_cache["market_intel"] = await asyncio.to_thread(compute_market_intel)

    await agriculture.preload()
    try:
        yield
    finally:
        await agriculture.shutdown()
        price_cache.clear()
