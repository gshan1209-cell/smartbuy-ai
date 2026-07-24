"""集中註冊 FastAPI Routers，避免應用入口持續膨脹。"""
from __future__ import annotations

from fastapi import FastAPI

from backend.routers.admin import router as admin_router
from backend.routers.agriculture import router as agriculture_router
from backend.routers.auth import router as auth_router
from backend.routers.favorites import router as favorites_router
from backend.routers.market import router as market_router
from backend.routers.misc import router as misc_router
from backend.routers.mutual_aid import router as mutual_aid_router
from backend.routers.notifications import router as notifications_router
from backend.routers.prediction import router as prediction_router
from backend.routers.product import router as product_router

ROUTERS = (
    auth_router,
    market_router,
    product_router,
    prediction_router,
    misc_router,
    favorites_router,
    mutual_aid_router,
    notifications_router,
    admin_router,
    agriculture_router,
)


def register_routers(app: FastAPI) -> None:
    """依既有順序註冊所有 API Router。"""
    for router in ROUTERS:
        app.include_router(router)
