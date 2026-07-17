from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from backend.routers.auth import _get_current_member_id
from src.data.favorites_repository import (
    list_favorites,
    add_favorite,
    remove_favorite,
)

router = APIRouter(prefix="/api/favorites")


class AddFavoriteRequest(BaseModel):
    type: Literal["news", "product"]
    ref_id: str
    meta: dict = {}

    model_config = {"extra": "forbid"}


@router.get("")
def favorites_list(
    type: Literal["news", "product"] = Query(...),
    member_id: int = Depends(_get_current_member_id),
):
    """取得目前登入會員指定類型的所有收藏。"""
    return list_favorites(member_id, type)


@router.post("")
def favorites_add(
    payload: AddFavoriteRequest,
    member_id: int = Depends(_get_current_member_id),
):
    """新增收藏（重複收藏不報錯）。"""
    add_favorite(member_id, payload.type, payload.ref_id, payload.meta)
    return {"success": True}


@router.delete("/{type}/{ref_id}")
def favorites_remove(
    type: Literal["news", "product"],
    ref_id: str,
    member_id: int = Depends(_get_current_member_id),
):
    """刪除單一收藏。"""
    remove_favorite(member_id, type, ref_id)
    return {"success": True}
