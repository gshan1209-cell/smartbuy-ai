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


def _normalize_news_ref_id(ref_id: str) -> int:
    """Validate and normalize an API news ref_id into a positive bigint."""
    value = str(ref_id).strip()
    if not value.isdigit():
        raise ValueError("新聞收藏 ref_id 必須是正整數。")

    news_article_id = int(value)
    if news_article_id <= 0 or news_article_id > 9223372036854775807:
        raise ValueError("新聞收藏 ref_id 必須是有效的 bigint 正整數。")

    return news_article_id


def _normalize_product_ref_id(ref_id: str) -> str:
    """Validate and normalize an API product ref_id into a crop code."""
    product_crop_code = str(ref_id).strip()
    if not product_crop_code:
        raise ValueError("產品收藏 ref_id 不可空白。")

    return product_crop_code


def list_favorites(member_id: int, fav_type: str) -> list[dict]:
    """列出會員指定類型的所有收藏，依收藏時間新到舊排序。"""
    if fav_type not in {"news", "product"}:
        raise ValueError("收藏 type 必須是 news 或 product。")

    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    CASE
                        WHEN type = 'news' THEN news_article_id::text
                        WHEN type = 'product' THEN product_crop_code
                    END AS ref_id,
                    meta,
                    created_at
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
    if fav_type == "news":
        news_article_id = _normalize_news_ref_id(ref_id)
        product_crop_code = None
        stored_ref_id = str(news_article_id)
    elif fav_type == "product":
        news_article_id = None
        product_crop_code = _normalize_product_ref_id(ref_id)
        stored_ref_id = product_crop_code
    else:
        raise ValueError("收藏 type 必須是 news 或 product。")

    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO user_favorites (
                    member_id,
                    type,
                    ref_id,
                    news_article_id,
                    product_crop_code,
                    meta
                )
                VALUES (
                    :member_id,
                    :fav_type,
                    :ref_id,
                    :news_article_id,
                    :product_crop_code,
                    CAST(:meta AS jsonb)
                )
                ON CONFLICT DO NOTHING;
                """
            ),
            {
                "member_id": member_id,
                "fav_type": fav_type,
                "ref_id": stored_ref_id,
                "news_article_id": news_article_id,
                "product_crop_code": product_crop_code,
                "meta": json.dumps(meta or {}, ensure_ascii=False),
            },
        )


def remove_favorite(member_id: int, fav_type: str, ref_id: str) -> None:
    """刪除單一收藏；不存在時視為成功。"""
    if fav_type == "news":
        delete_condition = "news_article_id = :news_article_id"
        params = {
            "member_id": member_id,
            "fav_type": fav_type,
            "news_article_id": _normalize_news_ref_id(ref_id),
        }
    elif fav_type == "product":
        delete_condition = "product_crop_code = :product_crop_code"
        params = {
            "member_id": member_id,
            "fav_type": fav_type,
            "product_crop_code": _normalize_product_ref_id(ref_id),
        }
    else:
        raise ValueError("收藏 type 必須是 news 或 product。")

    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                f"""
                DELETE FROM user_favorites
                WHERE member_id = :member_id
                  AND type = :fav_type
                  AND {delete_condition};
                """
            ),
            params,
        )
