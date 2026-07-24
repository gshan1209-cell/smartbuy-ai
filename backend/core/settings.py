"""FastAPI 應用程式層共用設定。

本模組只放應用程式組裝所需的穩定設定；業務規則與資料來源設定仍留在各自模組。
"""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

APP_TITLE = "SmartBuy AI API"
APP_VERSION = "1.0.0"

CORS_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://smartbuy-ai-react-v4nh.vercel.app",
)
CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"
