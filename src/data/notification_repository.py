# -*- coding: utf-8 -*-
"""
模組名稱: src.data.notification_repository
功能說明: 站內通知（互助網回文通知 / 點讚通知）資料存取層。

【相關元件 (Related Components)】
- 依賴: src.data.price_repository._load_database_url  (共用 DB URL 讀取)
- 依賴: sqlalchemy (資料庫操作)
- 被呼叫: backend/routers/notifications.py 的 /api/notifications 路由
- 被呼叫: src.data.mutual_aid_repository.add_comment() / toggle_like()
  （在自己的 transaction 內傳入 conn 呼叫 create_notification()，
  讓「留言／按讚」與「建立通知」同一個 transaction 提交，避免其中一個成功、
  另一個遺漏的不一致狀況）

【資料表】（由組員另外建立於 scripts/create_notifications_table.sql，此檔案僅假設其存在）
- notifications(id, recipient_member_id, actor_member_id, type, post_id,
  comment_id, is_read, created_at)
  - type 只有 'mutual_aid_reply' / 'mutual_aid_like' 兩種值
  - comment_id 可為 NULL（點讚通知沒有對應留言）
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from src.data.price_repository import _load_database_url

_ALLOWED_TYPES = {"mutual_aid_reply", "mutual_aid_like"}


def _get_engine():
    """建立 SQLAlchemy engine；若無 DATABASE_URL 則拋出例外。"""
    db_url = _load_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL 未設定，無法連線至資料庫。")
    return create_engine(db_url, pool_pre_ping=True)


def _notification_response(row) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "isRead": row["is_read"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        "actorId": row["actor_member_id"],
        "actorName": row["actor_name"],
        "postId": row["post_id"],
        "postPreview": row["post_preview"],
        "commentId": row["comment_id"],
    }


def create_notification(
    conn: Connection,
    recipient_member_id: int,
    actor_member_id: int,
    type_: str,
    post_id: int,
    comment_id: Optional[int] = None,
) -> None:
    """
    新增一筆通知。

    刻意不自己開 engine/transaction：呼叫端（add_comment() / toggle_like()）
    會傳入自己交易中的 conn，讓通知跟觸發它的動作在同一個 DB transaction 內提交。
    """
    if type_ not in _ALLOWED_TYPES:
        raise ValueError(f"不支援的通知類型：{type_}")

    conn.execute(
        text(
            """
            INSERT INTO notifications
                (recipient_member_id, actor_member_id, type, post_id, comment_id)
            VALUES
                (:recipient_member_id, :actor_member_id, :type, :post_id, :comment_id);
            """
        ),
        {
            "recipient_member_id": recipient_member_id,
            "actor_member_id": actor_member_id,
            "type": type_,
            "post_id": post_id,
            "comment_id": comment_id,
        },
    )


def has_like_notification(conn: Connection, actor_member_id: int, post_id: int) -> bool:
    """
    這個人是否已經對這篇貼文建立過按讚通知（不論現在是否還處於按讚狀態）。
    供 toggle_like() 判斷「同一人對同一貼文最多只通知一次」，取消讚再重讚不會重複通知。
    """
    row = conn.execute(
        text(
            """
            SELECT 1 FROM notifications
            WHERE type = 'mutual_aid_like'
              AND actor_member_id = :actor_member_id
              AND post_id = :post_id
            LIMIT 1;
            """
        ),
        {"actor_member_id": actor_member_id, "post_id": post_id},
    ).first()
    return row is not None


def list_notifications(member_id: int, limit: int = 20, offset: int = 0) -> dict:
    """
    列出會員收到的通知，依 created_at DESC 排序。
    回傳 {total, unreadCount, limit, offset, items}。
    """
    engine = _get_engine()
    with engine.connect() as conn:
        total = conn.execute(
            text("SELECT COUNT(*) FROM notifications WHERE recipient_member_id = :member_id;"),
            {"member_id": member_id},
        ).scalar_one()

        unread_count = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM notifications
                WHERE recipient_member_id = :member_id AND is_read = FALSE;
                """
            ),
            {"member_id": member_id},
        ).scalar_one()

        rows = conn.execute(
            text(
                """
                SELECT n.id, n.type, n.is_read, n.created_at,
                       n.actor_member_id, n.post_id, n.comment_id,
                       m.name AS actor_name,
                       LEFT(p.content, 80) AS post_preview
                FROM notifications n
                JOIN members m ON m.id = n.actor_member_id
                JOIN mutual_aid_posts p ON p.id = n.post_id
                WHERE n.recipient_member_id = :member_id
                ORDER BY n.created_at DESC
                LIMIT :limit OFFSET :offset;
                """
            ),
            {"member_id": member_id, "limit": limit, "offset": offset},
        ).mappings().all()

    return {
        "total": total,
        "unreadCount": unread_count,
        "limit": limit,
        "offset": offset,
        "items": [_notification_response(row) for row in rows],
    }


def count_unread(member_id: int) -> int:
    """只算未讀數量，供前端輪詢 badge 用的輕量查詢。"""
    engine = _get_engine()
    with engine.connect() as conn:
        return conn.execute(
            text(
                """
                SELECT COUNT(*) FROM notifications
                WHERE recipient_member_id = :member_id AND is_read = FALSE;
                """
            ),
            {"member_id": member_id},
        ).scalar_one()


def mark_read(notification_id: int, member_id: int) -> None:
    """標記單筆已讀；僅通知的收件人本人可操作。"""
    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT recipient_member_id FROM notifications WHERE id = :notification_id LIMIT 1;"),
            {"notification_id": notification_id},
        ).mappings().first()
        if row is None:
            raise LookupError("not_found")
        if row["recipient_member_id"] != member_id:
            raise PermissionError("forbidden")

        conn.execute(
            text("UPDATE notifications SET is_read = TRUE WHERE id = :notification_id;"),
            {"notification_id": notification_id},
        )


def mark_all_read(member_id: int) -> None:
    """把該會員所有未讀通知標記為已讀。"""
    engine = _get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE notifications
                SET is_read = TRUE
                WHERE recipient_member_id = :member_id AND is_read = FALSE;
                """
            ),
            {"member_id": member_id},
        )
