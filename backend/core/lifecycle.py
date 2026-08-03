"""FastAPI 啟動與關閉生命週期。"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from backend.cache import preload_market_cache, price_cache
from backend.routers import agriculture

logger = logging.getLogger(__name__)


async def _preload_market_cache() -> None:
    """背景預載行情資料，避免阻塞 FastAPI 首次可用時間。"""
    prices = await asyncio.to_thread(preload_market_cache)
    logger.info("行情快取背景預載完成：%d 筆價格資料。", len(prices))


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    """先載入本機農業快取，再背景預載行情，並在關閉時釋放工作。"""
    await agriculture.preload()
    market_cache_task = asyncio.create_task(_preload_market_cache())
    try:
        yield
    finally:
        if not market_cache_task.done():
            market_cache_task.cancel()
        with suppress(asyncio.CancelledError):
            await market_cache_task
        await agriculture.shutdown()
        price_cache.clear()
