# -*- coding: utf-8 -*-
"""
模組名稱: src.data.favorites_repository
功能說明: 會員收藏（新聞 / 品項）資料存取層。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository._load_database_url  (共用 DB URL 讀取)
- 依賴: sqlalchemy (資料庫操作)
- 被呼叫: backend/routers/favorites.py 的 /api/favorites 路由
"""
from __future__ import annotations

import json

from sqlalchemy import create_engine, text

from src.data.price_repository import _load_database_url


def _get_engine():
    """建立 SQLAlchemy engine；若無 DATABASE_URL 則拋出例外。"""
    db_url = _load_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL 未設定，無法連線至資料庫。")
    return create_engine(db_url, pool_pre_ping=True)


def list_favorites(member_id: int, fav_type: str) -> list[dict]:
    """列出會員指定類型的所有收藏，依收藏時間新到舊排序。"""
    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT ref_id, meta, created_at
                FROM user_favorites
                WHERE member_id = :member_id AND type = :fav_type
                ORDER BY created_at DESC;
                """
            ),
            {"member_id": member_id, "fav_type": fav_type},
        ).mappings().all()
    return [
        {
            "ref_id": row["ref_id"],
            "meta": row["meta"] or {},
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]


def add_favorite(member_id: int, fav_type: str, ref_id: str, meta: dict) -> None:
    """新增收藏；同一筆重複收藏不報錯（upsert）。"""
    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO user_favorites (member_id, type, ref_id, meta)
                VALUES (:member_id, :fav_type, :ref_id, CAST(:meta AS jsonb))
                ON CONFLICT (member_id, type, ref_id) DO NOTHING;
                """
            ),
            {
                "member_id": member_id,
                "fav_type": fav_type,
                "ref_id": ref_id,
                "meta": json.dumps(meta or {}, ensure_ascii=False),
            },
        )


def remove_favorite(member_id: int, fav_type: str, ref_id: str) -> None:
    """刪除單一收藏；不存在時視為成功。"""
    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                DELETE FROM user_favorites
                WHERE member_id = :member_id AND type = :fav_type AND ref_id = :ref_id;
                """
            ),
            {"member_id": member_id, "fav_type": fav_type, "ref_id": ref_id},
        )
