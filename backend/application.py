"""SmartBuy AI FastAPI 應用程式工廠。"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.router import register_routers
from backend.core.lifecycle import app_lifespan
from backend.core.settings import (
    APP_TITLE,
    APP_VERSION,
    CORS_ORIGIN_REGEX,
    CORS_ORIGINS,
)


def create_app() -> FastAPI:
    """建立並完成 SmartBuy AI FastAPI 應用程式組裝。"""
    app = FastAPI(
        title=APP_TITLE,
        version=APP_VERSION,
        lifespan=app_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(CORS_ORIGINS),
        allow_origin_regex=CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    register_routers(app)
    return app
