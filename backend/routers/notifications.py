from fastapi import APIRouter, Depends, HTTPException, Query

from backend.routers.auth import _get_current_member_id
from src.data.notification_repository import (
    list_notifications,
    count_unread,
    mark_read,
    mark_all_read,
)

router = APIRouter(prefix="/api/notifications")


def _handle_repo_error(exc: Exception):
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=404, detail="找不到指定的通知。")
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=403, detail="沒有權限執行此操作。")
    raise exc


@router.get("")
def notifications_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    member_id: int = Depends(_get_current_member_id),
):
    """列出目前登入會員收到的通知（含 total、unreadCount，依 created_at 由新到舊排序）。"""
    return list_notifications(member_id, limit=limit, offset=offset)


@router.get("/unread-count")
def notifications_unread_count(member_id: int = Depends(_get_current_member_id)):
    """只回傳未讀通知數量，供前端輪詢 badge 使用。"""
    return {"unreadCount": count_unread(member_id)}


@router.patch("/{notification_id}/read")
def notifications_mark_read(
    notification_id: int,
    member_id: int = Depends(_get_current_member_id),
):
    """標記單筆通知為已讀（僅收件人本人可操作）。"""
    try:
        mark_read(notification_id, member_id)
    except (LookupError, PermissionError) as exc:
        _handle_repo_error(exc)
    return {"success": True}


@router.patch("/read-all")
def notifications_mark_all_read(member_id: int = Depends(_get_current_member_id)):
    """將目前登入會員所有未讀通知標記為已讀。"""
    mark_all_read(member_id)
    return {"success": True}
