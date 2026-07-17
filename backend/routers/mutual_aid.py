from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend.routers.auth import _get_current_member_id, _get_current_member_id_optional
from src.data.mutual_aid_repository import (
    list_posts,
    get_post,
    create_post,
    update_post,
    delete_post,
    update_post_status,
    add_comment,
    delete_comment,
    toggle_like,
    toggle_save,
    list_saved_posts,
    upload_post_image,
)

router = APIRouter(prefix="/api/mutual-aid")

_ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "webp"}
_MAX_IMAGE_SIZE = 5 * 1024 * 1024


class PostCreate(BaseModel):
    type: Literal["滯銷急售", "求助", "資訊分享"]
    content: str
    farm_name: Optional[str] = None
    location_city: Optional[str] = None
    location_addr: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    images: list[str] = []

    model_config = {"extra": "forbid"}


class PostUpdate(BaseModel):
    type: Optional[Literal["滯銷急售", "求助", "資訊分享"]] = None
    content: Optional[str] = None
    farm_name: Optional[str] = None
    location_city: Optional[str] = None
    location_addr: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    images: Optional[list[str]] = None

    model_config = {"extra": "forbid"}


class PostStatusUpdate(BaseModel):
    status: Literal["open", "dealing", "closed"]

    model_config = {"extra": "forbid"}


class CommentCreate(BaseModel):
    content: str

    model_config = {"extra": "forbid"}


def _handle_repo_error(exc: Exception):
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=404, detail="找不到指定的資源。")
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=403, detail="沒有權限執行此操作。")
    raise exc


@router.get("/posts")
def mutual_aid_list_posts(
    type: Optional[Literal["滯銷急售", "求助", "資訊分享"]] = Query(None),
    city: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    sort: Literal["latest", "likes"] = Query("latest"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    member_id: Optional[int] = Depends(_get_current_member_id_optional),
):
    """列出貼文，支援類型/縣市/關鍵字篩選、排序與分頁。"""
    return list_posts(
        type=type, city=city, q=q, sort=sort, limit=limit, offset=offset, member_id=member_id
    )


@router.get("/saved")
def mutual_aid_list_saved(member_id: int = Depends(_get_current_member_id)):
    """取得目前登入會員收藏的所有貼文。"""
    return list_saved_posts(member_id)


@router.get("/posts/{post_id}")
def mutual_aid_get_post(
    post_id: int,
    member_id: Optional[int] = Depends(_get_current_member_id_optional),
):
    """取得單一貼文詳情（含留言）。"""
    post = get_post(post_id, member_id=member_id)
    if post is None:
        raise HTTPException(status_code=404, detail="找不到指定的貼文。")
    return post


@router.post("/posts", status_code=201)
def mutual_aid_create_post(
    payload: PostCreate,
    member_id: int = Depends(_get_current_member_id),
):
    """發布新貼文。"""
    try:
        return create_post(member_id=member_id, **payload.model_dump())
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.patch("/posts/{post_id}")
def mutual_aid_update_post(
    post_id: int,
    payload: PostUpdate,
    member_id: int = Depends(_get_current_member_id),
):
    """更新貼文（僅作者可操作）。"""
    try:
        return update_post(post_id, member_id, payload.model_dump(exclude_unset=True))
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.delete("/posts/{post_id}")
def mutual_aid_delete_post(
    post_id: int,
    member_id: int = Depends(_get_current_member_id),
):
    """刪除貼文（僅作者可操作）。"""
    try:
        delete_post(post_id, member_id)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)
    return {"success": True}


@router.patch("/posts/{post_id}/status")
def mutual_aid_update_status(
    post_id: int,
    payload: PostStatusUpdate,
    member_id: int = Depends(_get_current_member_id),
):
    """更新貼文狀態（僅作者可操作）。"""
    try:
        return update_post_status(post_id, member_id, payload.status)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.post("/posts/{post_id}/comments", status_code=201)
def mutual_aid_add_comment(
    post_id: int,
    payload: CommentCreate,
    member_id: int = Depends(_get_current_member_id),
):
    """新增留言。"""
    try:
        return add_comment(post_id, member_id, payload.content)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.delete("/comments/{comment_id}")
def mutual_aid_delete_comment(
    comment_id: int,
    member_id: int = Depends(_get_current_member_id),
):
    """刪除留言（僅留言作者可操作）。"""
    try:
        delete_comment(comment_id, member_id)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)
    return {"success": True}


@router.post("/posts/{post_id}/like")
def mutual_aid_toggle_like(
    post_id: int,
    member_id: int = Depends(_get_current_member_id),
):
    """切換按讚狀態。"""
    try:
        return toggle_like(post_id, member_id)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.post("/posts/{post_id}/save")
def mutual_aid_toggle_save(
    post_id: int,
    member_id: int = Depends(_get_current_member_id),
):
    """切換收藏狀態。"""
    try:
        return toggle_save(post_id, member_id)
    except (ValueError, LookupError, PermissionError) as exc:
        _handle_repo_error(exc)


@router.post("/upload-image")
async def mutual_aid_upload_image(
    file: UploadFile = File(...),
    member_id: int = Depends(_get_current_member_id),
):
    """上傳貼文圖片至 R2，回傳公開 URL。"""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in _ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=422, detail="圖片格式僅支援 jpg / jpeg / png / webp。")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_IMAGE_SIZE:
        raise HTTPException(status_code=422, detail="圖片大小不可超過 5MB。")

    try:
        url = upload_post_image(member_id, file_bytes)
    except RuntimeError as exc:
        if str(exc) == "r2_not_configured":
            raise HTTPException(status_code=503, detail="圖片上傳服務尚未設定。")
        raise HTTPException(status_code=500, detail="圖片上傳失敗，請稍後再試。")

    return {"url": url}
