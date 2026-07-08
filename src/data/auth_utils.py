# -*- coding: utf-8 -*-
"""
模組名稱: src.data.auth_utils
功能說明: JWT Token 的產生與驗證工具。
         Secret Key 從環境變數 JWT_SECRET_KEY 讀取。

【相關元件 (Related Components)】
- 依賴: python-jose (JWT 操作)
- 被呼叫: backend/main.py 的 /api/auth/* 路由
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

# ── 設定 ──────────────────────────────────────────────────────────────────────
# JWT_SECRET_KEY 從環境變數讀取；若未設定則使用開發用預設值
# ⚠️ 正式環境務必在 Render / Vercel 設定此環境變數為隨機強密碼
_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "smartbuy-dev-secret-change-in-production")
_ALGORITHM: str = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


# ── 公開函式 ──────────────────────────────────────────────────────────────────

def create_access_token(member_id: int, email: str) -> str:
    """
    產生 JWT Access Token。

    參數:
        member_id: 會員 ID（存入 sub）
        email:     會員 Email（存入 email）

    回傳:
        str: 簽名後的 JWT 字串
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(member_id),
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    解碼並驗證 JWT Token。

    參數:
        token: JWT 字串

    回傳:
        dict: { member_id, email } 若有效
        None: 若 Token 無效或已過期
    """
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        member_id = payload.get("sub")
        email = payload.get("email")
        if member_id is None or email is None:
            return None
        return {"member_id": int(member_id), "email": email}
    except JWTError:
        return None
