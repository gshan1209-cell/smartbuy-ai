# -*- coding: utf-8 -*-
"""
模組名稱: src.data.mutual_aid_repository
功能說明: 互助網（貼文 / 留言 / 按讚 / 收藏 / 圖片上傳）資料存取層。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository._load_database_url  (共用 DB URL 讀取)
- 依賴: src.data.r2_sync  (共用 R2 boto3 client 建構)
- 依賴: sqlalchemy (資料庫操作)
- 依賴: Pillow (圖片轉 webp)
- 被呼叫: backend/routers/mutual_aid.py 的 /api/mutual-aid 路由

【資料表】（由組員另外建立，此檔案僅假設其存在）
- mutual_aid_posts(id, member_id, type, content, farm_name, location_city,
  location_addr, location_lat, location_lng, images, status, like_count,
  created_at, updated_at)
- mutual_aid_comments(id, post_id, member_id, content, created_at)
- mutual_aid_likes(post_id, member_id)  -- PK (post_id, member_id)
- mutual_aid_saved(post_id, member_id) -- PK (post_id, member_id)
"""
from __future__ import annotations

import os
import uuid
from io import BytesIO
from typing import Optional

from sqlalchemy import create_engine, text

from src.data.price_repository import _load_database_url
from src.data.r2_sync import _get_r2_client, is_r2_configured

_MAX_IMAGES = 5
_ALLOWED_STATUS = {"open", "dealing", "closed"}
_ALLOWED_TYPES = {"滯銷急售", "求助", "資訊分享"}


def _get_engine():
    """建立 SQLAlchemy engine；若無 DATABASE_URL 則拋出例外。"""
    db_url = _load_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL 未設定，無法連線至資料庫。")
    return create_engine(db_url, pool_pre_ping=True)


def _post_response(row) -> dict:
    return {
        "id": row["id"],
        "member_id": row["member_id"],
        "author_name": row["author_name"],
        "type": row["type"],
        "content": row["content"],
        "farm_name": row["farm_name"],
        "location_city": row["location_city"],
        "location_addr": row["location_addr"],
        "location_lat": float(row["location_lat"]) if row["location_lat"] is not None else None,
        "location_lng": float(row["location_lng"]) if row["location_lng"] is not None else None,
        "images": list(row["images"] or []),
        "status": row["status"],
        "like_count": row["like_count"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "is_liked": bool(row["is_liked"]) if row.get("is_liked") is not None else None,
        "is_saved": bool(row["is_saved"]) if row.get("is_saved") is not None else None,
    }


def _comment_response(row) -> dict:
    return {
        "id": row["id"],
        "post_id": row["post_id"],
        "member_id": row["member_id"],
        "author_name": row["author_name"],
        "content": row["content"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def list_posts(
    type: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = "latest",
    limit: int = 20,
    offset: int = 0,
    member_id: Optional[int] = None,
) -> list[dict]:
    """列出貼文，支援類型/縣市/關鍵字篩選與排序分頁。"""
    order_by = "p.like_count DESC, p.created_at DESC" if sort == "likes" else "p.created_at DESC"

    where_parts = []
    params: dict = {"limit": limit, "offset": offset}
    if type is not None:
        where_parts.append("p.type = :type")
        params["type"] = type
    if city is not None:
        where_parts.append("p.location_city = :city")
        params["city"] = city
    if q is not None:
        where_parts.append("(p.content ILIKE :q OR p.location_addr ILIKE :q)")
        params["q"] = f"%{q}%"
    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    is_liked_expr = "NULL AS is_liked"
    is_saved_expr = "NULL AS is_saved"
    liked_join = ""
    saved_join = ""
    if member_id is not None:
        is_liked_expr = "(l.member_id IS NOT NULL) AS is_liked"
        is_saved_expr = "(s.member_id IS NOT NULL) AS is_saved"
        liked_join = "LEFT JOIN mutual_aid_likes l ON l.post_id = p.id AND l.member_id = :member_id"
        saved_join = "LEFT JOIN mutual_aid_saved s ON s.post_id = p.id AND s.member_id = :member_id"
        params["member_id"] = member_id

    sql = f"""
        SELECT p.*, m.name AS author_name, {is_liked_expr}, {is_saved_expr}
        FROM mutual_aid_posts p
        JOIN members m ON m.id = p.member_id
        {liked_join}
        {saved_join}
        {where_clause}
        ORDER BY {order_by}
        LIMIT :limit OFFSET :offset;
    """

    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return [_post_response(row) for row in rows]


def get_post(post_id: int, member_id: Optional[int] = None) -> Optional[dict]:
    """取得單一貼文（含留言陣列）；不存在回傳 None。"""
    is_liked_expr = "NULL AS is_liked"
    is_saved_expr = "NULL AS is_saved"
    liked_join = ""
    saved_join = ""
    params: dict = {"post_id": post_id}
    if member_id is not None:
        is_liked_expr = "(l.member_id IS NOT NULL) AS is_liked"
        is_saved_expr = "(s.member_id IS NOT NULL) AS is_saved"
        liked_join = "LEFT JOIN mutual_aid_likes l ON l.post_id = p.id AND l.member_id = :member_id"
        saved_join = "LEFT JOIN mutual_aid_saved s ON s.post_id = p.id AND s.member_id = :member_id"
        params["member_id"] = member_id

    engine = _get_engine()
    with engine.connect() as conn:
        post_row = conn.execute(
            text(
                f"""
                SELECT p.*, m.name AS author_name, {is_liked_expr}, {is_saved_expr}
                FROM mutual_aid_posts p
                JOIN members m ON m.id = p.member_id
                {liked_join}
                {saved_join}
                WHERE p.id = :post_id
                LIMIT 1;
                """
            ),
            params,
        ).mappings().first()

        if post_row is None:
            return None

        comment_rows = conn.execute(
            text(
                """
                SELECT c.*, m.name AS author_name
                FROM mutual_aid_comments c
                JOIN members m ON m.id = c.member_id
                WHERE c.post_id = :post_id
                ORDER BY c.created_at ASC;
                """
            ),
            {"post_id": post_id},
        ).mappings().all()

    post = _post_response(post_row)
    post["comments"] = [_comment_response(row) for row in comment_rows]
    return post


def create_post(
    member_id: int,
    type: str,
    content: str,
    farm_name: Optional[str] = None,
    location_city: Optional[str] = None,
    location_addr: Optional[str] = None,
    location_lat: Optional[float] = None,
    location_lng: Optional[float] = None,
    images: Optional[list[str]] = None,
) -> dict:
    """建立貼文。"""
    images = images or []
    if len(images) > _MAX_IMAGES:
        raise ValueError(f"圖片最多 {_MAX_IMAGES} 張。")
    if not content or not content.strip():
        raise ValueError("內文不可空白。")

    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO mutual_aid_posts
                    (member_id, type, content, farm_name, location_city,
                     location_addr, location_lat, location_lng, images)
                VALUES
                    (:member_id, :type, :content, :farm_name, :location_city,
                     :location_addr, :location_lat, :location_lng, :images)
                RETURNING id;
                """
            ),
            {
                "member_id": member_id,
                "type": type,
                "content": content.strip(),
                "farm_name": farm_name,
                "location_city": location_city,
                "location_addr": location_addr,
                "location_lat": location_lat,
                "location_lng": location_lng,
                "images": images,
            },
        ).mappings().first()

    return get_post(row["id"], member_id=member_id)


def _require_owner(conn, table: str, row_id: int, member_id: int, id_col: str = "id") -> None:
    row = conn.execute(
        text(f"SELECT member_id FROM {table} WHERE {id_col} = :row_id LIMIT 1;"),
        {"row_id": row_id},
    ).mappings().first()
    if row is None:
        raise LookupError("not_found")
    if row["member_id"] != member_id:
        raise PermissionError("forbidden")


def update_post(post_id: int, member_id: int, patch: dict) -> dict:
    """更新貼文（只更新有傳入的欄位）；僅作者可操作。"""
    allowed_fields = {
        "type", "content", "farm_name", "location_city",
        "location_addr", "location_lat", "location_lng", "images",
    }
    patch = {k: v for k, v in patch.items() if k in allowed_fields}
    if "images" in patch and len(patch["images"] or []) > _MAX_IMAGES:
        raise ValueError(f"圖片最多 {_MAX_IMAGES} 張。")
    if "content" in patch and not (patch["content"] or "").strip():
        raise ValueError("內文不可空白。")

    engine = _get_engine()
    with engine.begin() as conn:
        _require_owner(conn, "mutual_aid_posts", post_id, member_id)

        if patch:
            set_parts = [f"{field} = :{field}" for field in patch]
            params = {**patch, "post_id": post_id}
            conn.execute(
                text(f"UPDATE mutual_aid_posts SET {', '.join(set_parts)} WHERE id = :post_id;"),
                params,
            )

    return get_post(post_id, member_id=member_id)


def delete_post(post_id: int, member_id: int) -> None:
    """刪除貼文；僅作者可操作。"""
    engine = _get_engine()
    with engine.begin() as conn:
        _require_owner(conn, "mutual_aid_posts", post_id, member_id)
        conn.execute(text("DELETE FROM mutual_aid_posts WHERE id = :post_id;"), {"post_id": post_id})


def update_post_status(post_id: int, member_id: int, status: str) -> dict:
    """更新貼文狀態；僅作者可操作。"""
    if status not in _ALLOWED_STATUS:
        raise ValueError("狀態值不在允許範圍內。")

    engine = _get_engine()
    with engine.begin() as conn:
        _require_owner(conn, "mutual_aid_posts", post_id, member_id)
        conn.execute(
            text("UPDATE mutual_aid_posts SET status = :status WHERE id = :post_id;"),
            {"status": status, "post_id": post_id},
        )

    return get_post(post_id, member_id=member_id)


def add_comment(post_id: int, member_id: int, content: str) -> dict:
    """新增留言。"""
    if not content or not content.strip():
        raise ValueError("留言內容不可空白。")

    engine = _get_engine()
    with engine.begin() as conn:
        post_row = conn.execute(
            text("SELECT id FROM mutual_aid_posts WHERE id = :post_id LIMIT 1;"),
            {"post_id": post_id},
        ).mappings().first()
        if post_row is None:
            raise LookupError("not_found")

        comment_row = conn.execute(
            text(
                """
                INSERT INTO mutual_aid_comments (post_id, member_id, content)
                VALUES (:post_id, :member_id, :content)
                RETURNING id;
                """
            ),
            {"post_id": post_id, "member_id": member_id, "content": content.strip()},
        ).mappings().first()

        row = conn.execute(
            text(
                """
                SELECT c.*, m.name AS author_name
                FROM mutual_aid_comments c
                JOIN members m ON m.id = c.member_id
                WHERE c.id = :comment_id;
                """
            ),
            {"comment_id": comment_row["id"]},
        ).mappings().first()

    return _comment_response(row)


def delete_comment(comment_id: int, member_id: int) -> None:
    """刪除留言；僅留言作者可操作。"""
    engine = _get_engine()
    with engine.begin() as conn:
        _require_owner(conn, "mutual_aid_comments", comment_id, member_id)
        conn.execute(text("DELETE FROM mutual_aid_comments WHERE id = :comment_id;"), {"comment_id": comment_id})


def toggle_like(post_id: int, member_id: int) -> dict:
    """切換按讚狀態，回傳 { liked, like_count }。"""
    engine = _get_engine()
    with engine.begin() as conn:
        post_row = conn.execute(
            text("SELECT id FROM mutual_aid_posts WHERE id = :post_id LIMIT 1;"),
            {"post_id": post_id},
        ).mappings().first()
        if post_row is None:
            raise LookupError("not_found")

        existing = conn.execute(
            text(
                "SELECT 1 FROM mutual_aid_likes WHERE post_id = :post_id AND member_id = :member_id;"
            ),
            {"post_id": post_id, "member_id": member_id},
        ).first()

        if existing:
            conn.execute(
                text(
                    "DELETE FROM mutual_aid_likes WHERE post_id = :post_id AND member_id = :member_id;"
                ),
                {"post_id": post_id, "member_id": member_id},
            )
            conn.execute(
                text(
                    "UPDATE mutual_aid_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = :post_id;"
                ),
                {"post_id": post_id},
            )
            liked = False
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO mutual_aid_likes (post_id, member_id)
                    VALUES (:post_id, :member_id)
                    ON CONFLICT DO NOTHING;
                    """
                ),
                {"post_id": post_id, "member_id": member_id},
            )
            conn.execute(
                text("UPDATE mutual_aid_posts SET like_count = like_count + 1 WHERE id = :post_id;"),
                {"post_id": post_id},
            )
            liked = True

        like_count = conn.execute(
            text("SELECT like_count FROM mutual_aid_posts WHERE id = :post_id;"),
            {"post_id": post_id},
        ).scalar_one()

    return {"liked": liked, "like_count": like_count}


def toggle_save(post_id: int, member_id: int) -> dict:
    """切換收藏狀態，回傳 { saved }。"""
    engine = _get_engine()
    with engine.begin() as conn:
        post_row = conn.execute(
            text("SELECT id FROM mutual_aid_posts WHERE id = :post_id LIMIT 1;"),
            {"post_id": post_id},
        ).mappings().first()
        if post_row is None:
            raise LookupError("not_found")

        existing = conn.execute(
            text(
                "SELECT 1 FROM mutual_aid_saved WHERE post_id = :post_id AND member_id = :member_id;"
            ),
            {"post_id": post_id, "member_id": member_id},
        ).first()

        if existing:
            conn.execute(
                text(
                    "DELETE FROM mutual_aid_saved WHERE post_id = :post_id AND member_id = :member_id;"
                ),
                {"post_id": post_id, "member_id": member_id},
            )
            saved = False
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO mutual_aid_saved (post_id, member_id)
                    VALUES (:post_id, :member_id)
                    ON CONFLICT DO NOTHING;
                    """
                ),
                {"post_id": post_id, "member_id": member_id},
            )
            saved = True

    return {"saved": saved}


def list_saved_posts(member_id: int) -> list[dict]:
    """列出會員收藏的所有貼文，依收藏無關的貼文建立時間新到舊排序。"""
    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.*, m.name AS author_name,
                       (l.member_id IS NOT NULL) AS is_liked
                FROM mutual_aid_saved s
                JOIN mutual_aid_posts p ON p.id = s.post_id
                JOIN members m ON m.id = p.member_id
                LEFT JOIN mutual_aid_likes l ON l.post_id = p.id AND l.member_id = :member_id
                WHERE s.member_id = :member_id
                ORDER BY p.created_at DESC;
                """
            ),
            {"member_id": member_id},
        ).mappings().all()

    posts = []
    for row in rows:
        post = _post_response(row)
        post["is_saved"] = True
        posts.append(post)
    return posts


def upload_post_image(member_id: int, file_bytes: bytes) -> str:
    """將圖片轉為 webp 後上傳至 R2，回傳公開存取 URL。"""
    from PIL import Image

    if not is_r2_configured():
        raise RuntimeError("r2_not_configured")

    public_url = os.getenv("R2_PUBLIC_URL")
    bucket_name = os.getenv("R2_BUCKET_NAME")
    if not public_url or not bucket_name:
        raise RuntimeError("r2_not_configured")

    image = Image.open(BytesIO(file_bytes))
    image = image.convert("RGB")
    buffer = BytesIO()
    image.save(buffer, format="WEBP", quality=85)
    buffer.seek(0)

    key = f"mutual-aid/{member_id}/{uuid.uuid4()}.webp"
    client = _get_r2_client()
    client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=buffer.getvalue(),
        ContentType="image/webp",
    )

    return f"{public_url.rstrip('/')}/{key}"
