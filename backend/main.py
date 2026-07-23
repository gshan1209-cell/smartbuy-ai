"""
SmartBuy AI — FastAPI 後端
"""
from __future__ import annotations

import logging
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.anomaly.price_status import get_all_price_statuses
from src.data.price_repository import load_price_history
from backend.cache import price_cache, compute_market_intel

from backend.routers.auth       import router as auth_router
from backend.routers.market     import router as market_router
from backend.routers.product    import router as product_router
from backend.routers.prediction import router as prediction_router
from backend.routers.misc       import router as misc_router
from backend.routers.favorites  import router as favorites_router
from backend.routers.mutual_aid import router as mutual_aid_router
from backend.routers.notifications import router as notifications_router
from backend.routers.admin import router as admin_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    prices = await asyncio.to_thread(lambda: load_price_history(days=30))
    price_cache["prices"]          = prices
    price_cache["all_statuses"]    = await asyncio.to_thread(get_all_price_statuses, prices=prices)
    price_cache["market_intel"]    = await asyncio.to_thread(compute_market_intel)
    yield
    price_cache.clear()


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


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(market_router)
app.include_router(product_router)
app.include_router(prediction_router)
app.include_router(misc_router)
app.include_router(favorites_router)
app.include_router(mutual_aid_router)
app.include_router(notifications_router)
app.include_router(admin_router)
