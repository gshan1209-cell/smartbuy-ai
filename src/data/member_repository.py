# -*- coding: utf-8 -*-
"""
模組名稱: src.data.member_repository
功能說明: 會員資料存取層，處理會員的註冊、登入驗證、資料更新。
         密碼使用 bcrypt 雜湊，不儲存明文。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository._load_database_url  (共用 DB URL 讀取)
- 依賴: sqlalchemy (資料庫操作)
- 依賴: bcrypt (密碼雜湊)
- 被呼叫: backend/main.py 的 /api/auth/* 路由
"""
from __future__ import annotations

import re
from typing import Optional

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from src.data.price_repository import _load_database_url


# ── 欄位驗證輔助 ──────────────────────────────────────────────────────────────

def _validate_email(email: str) -> bool:
    """簡易 Email 格式驗證（含 @ 與 .）。"""
    pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    return bool(re.match(pattern, email.strip()))


def _hash_password(plain_password: str) -> str:
    """使用 bcrypt 雜湊明文密碼，回傳雜湊字串。"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def _verify_password(plain_password: str, hashed: str) -> bool:
    """驗證明文密碼與 bcrypt 雜湊是否相符。"""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed.encode("utf-8"),
    )


def _get_engine():
    """建立 SQLAlchemy engine；若無 DATABASE_URL 則拋出例外。"""
    db_url = _load_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL 未設定，無法連線至資料庫。")
    return create_engine(db_url, pool_pre_ping=True)


# ── 公開函式 ──────────────────────────────────────────────────────────────────

def register_member(
    email: str,
    password: str,
    name: str,
) -> dict:
    """
    註冊新會員。

    參數:
        email:    電子郵件（必填，唯一）
        password: 明文密碼（必填，長度 >= 8）
        name:     顯示名稱（必填）

    回傳:
        dict: { member_id, email, name }

    例外:
        ValueError:  欄位驗證失敗
        RuntimeError: Email 已被使用或 DB 連線問題
    """
    # ── 欄位驗證 ──
    if not email or not _validate_email(email):
        raise ValueError("請輸入有效的電子郵件地址。")
    if not password or len(password) < 8:
        raise ValueError("密碼長度至少需要 8 個字元。")
    if not name or not name.strip():
        raise ValueError("顯示名稱不可空白。")

    password_hash = _hash_password(password)

    engine = _get_engine()
    try:
        with engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    INSERT INTO members (email, password_hash, name)
                    VALUES (:email, :password_hash, :name)
                    RETURNING id, email, name;
                    """
                ),
                {
                    "email": email.strip().lower(),
                    "password_hash": password_hash,
                    "name": name.strip(),
                },
            ).mappings().first()
        return {
            "member_id": result["id"],
            "email": result["email"],
            "name": result["name"],
        }
    except IntegrityError:
        # UNIQUE 約束衝突 → Email 已存在
        raise RuntimeError("email_already_exists")
    except Exception as exc:
        raise RuntimeError(f"資料庫錯誤：{exc}") from exc


def login_member(email: str, password: str) -> Optional[dict]:
    """
    驗證會員登入。

    參數:
        email:    電子郵件
        password: 明文密碼

    回傳:
        dict: { id, email, name, plan } 若驗證成功
        None: 若帳號不存在或密碼錯誤
    """
    if not email or not password:
        return None

    engine = _get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, email, name, plan, password_hash
                FROM members
                WHERE email = :email
                LIMIT 1;
                """
            ),
            {"email": email.strip().lower()},
        ).mappings().first()

    if row is None:
        return None
    if not _verify_password(password, row["password_hash"]):
        return None

    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "plan": row["plan"],
    }


def update_member_profile(
    member_id: int,
    name: Optional[str] = None,
) -> dict:
    """
    更新會員的顯示名稱。
    只傳入需要修改的欄位；未傳入欄位維持原值。

    參數:
        member_id: 會員 ID
        name:      新的顯示名稱（選填）

    回傳:
        dict: 更新後的會員資料 { id, email, name, plan }

    例外:
        ValueError:  欄位驗證失敗
        RuntimeError: 找不到該會員
    """
    if name is not None and not name.strip():
        raise ValueError("顯示名稱不可空白。")

    # 動態組合 SET 子句（只更新有傳入的欄位）
    set_parts = []
    params: dict = {"member_id": member_id}
    if name is not None:
        set_parts.append("name = :name")
        params["name"] = name.strip()

    if not set_parts:
        raise ValueError("未提供任何要更新的欄位。")

    sql = f"""
        UPDATE members
        SET {', '.join(set_parts)}
        WHERE id = :member_id
        RETURNING id, email, name, plan;
    """

    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(text(sql), params).mappings().first()

    if row is None:
        raise RuntimeError("找不到對應的會員資料。")

    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "plan": row["plan"],
    }


_PREFS_FIELD_MAP = {
    "priceAlert": "price_alert",
    "weatherAlert": "weather_alert",
    "mutualAidReply": "mutual_aid_reply",
    "fontSize": "font_size",
    "layout": "layout_mode",
    "theme": "theme",
}

_PREFS_ALLOWED_VALUES = {
    "fontSize": {"sm", "md", "lg"},
    "layout": {"simple", "detailed"},
    "theme": {"light", "dark"},
}


def _preferences_response(row) -> dict:
    return {
        "priceAlert": row["price_alert"],
        "weatherAlert": row["weather_alert"],
        "mutualAidReply": row["mutual_aid_reply"],
        "fontSize": row["font_size"],
        "layout": row["layout_mode"],
        "theme": row["theme"],
    }


def get_preferences(member_id: int) -> dict:
    """
    取得會員的推播與顯示偏好；若尚無資料則以預設值建立一筆。
    """
    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT price_alert, weather_alert, mutual_aid_reply,
                       font_size, layout_mode, theme
                FROM user_preferences
                WHERE member_id = :member_id
                LIMIT 1;
                """
            ),
            {"member_id": member_id},
        ).mappings().first()

        if row is None:
            row = conn.execute(
                text(
                    """
                    INSERT INTO user_preferences (member_id)
                    VALUES (:member_id)
                    RETURNING price_alert, weather_alert, mutual_aid_reply,
                              font_size, layout_mode, theme;
                    """
                ),
                {"member_id": member_id},
            ).mappings().first()

    return _preferences_response(row)


def update_preferences(member_id: int, patch: dict) -> dict:
    """
    更新會員的推播與顯示偏好（只更新有傳入的欄位）。

    參數:
        member_id: 會員 ID
        patch:     欲更新欄位，key 為前端命名（priceAlert / fontSize ...）

    例外:
        ValueError: 欄位值不在允許範圍內
    """
    for api_field, allowed in _PREFS_ALLOWED_VALUES.items():
        if api_field in patch and patch[api_field] not in allowed:
            raise ValueError(f"{api_field} 的值不在允許範圍內。")

    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO user_preferences (member_id)
                SELECT :member_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_preferences WHERE member_id = :member_id
                );
                """
            ),
            {"member_id": member_id},
        )

        set_parts = []
        params: dict = {"member_id": member_id}
        for api_field, db_field in _PREFS_FIELD_MAP.items():
            if api_field in patch:
                set_parts.append(f"{db_field} = :{api_field}")
                params[api_field] = patch[api_field]

        if set_parts:
            conn.execute(
                text(f"UPDATE user_preferences SET {', '.join(set_parts)} WHERE member_id = :member_id;"),
                params,
            )

        row = conn.execute(
            text(
                """
                SELECT price_alert, weather_alert, mutual_aid_reply,
                       font_size, layout_mode, theme
                FROM user_preferences
                WHERE member_id = :member_id
                LIMIT 1;
                """
            ),
            {"member_id": member_id},
        ).mappings().first()

    return _preferences_response(row)


def get_member_by_id(member_id: int) -> Optional[dict]:
    """
    依 ID 查詢單一會員資料（不含密碼雜湊）。

    參數:
        member_id: 會員 ID

    回傳:
        dict 或 None
    """
    engine = _get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, email, name, plan
                FROM members
                WHERE id = :member_id
                LIMIT 1;
                """
            ),
            {"member_id": member_id},
        ).mappings().first()

    if row is None:
        return None
    return dict(row)
