from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, field_validator

from backend.security.roles import normalize_role
from src.data.auth_utils import create_access_token, decode_access_token
from src.data.member_repository import (
    change_password,
    get_member_by_id,
    get_preferences,
    login_member,
    register_member,
    update_member_profile,
    update_preferences,
)

router = APIRouter(prefix="/api/auth")


def _get_current_member_id(request: Request) -> int:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="請先登入。")
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token 無效或已過期，請重新登入。")
    return payload["member_id"]


def _get_current_member_id_optional(request: Request) -> int | None:
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    return payload["member_id"]


def _normalize_member(member: dict) -> dict:
    return {**member, "role": normalize_role(member.get("role"))}


class RegisterRequest(BaseModel):
    """會員申請表單欄位（不含 plan 與 role）。"""

    email: str
    password: str
    name: str

    model_config = {"extra": "forbid"}


class LoginRequest(BaseModel):
    """會員登入表單欄位。"""

    email: str
    password: str

    model_config = {"extra": "forbid"}


class UpdateProfileRequest(BaseModel):
    """更新會員資料；只允許顯示名稱，不接受 role。"""

    name: str | None = None

    model_config = {"extra": "forbid"}


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    model_config = {"extra": "forbid"}

    @field_validator("new_password")
    @classmethod
    def validate_length(cls, value):
        if len(value) < 6:
            raise ValueError("新密碼至少需要 6 個字元")
        return value


class UpdatePreferencesRequest(BaseModel):
    """更新會員推播與顯示偏好。"""

    priceAlert: bool | None = None
    weatherAlert: bool | None = None
    mutualAidReply: bool | None = None
    mutualAidLike: bool | None = None
    fontSize: Literal["sm", "md", "lg"] | None = None
    layout: Literal["simple", "detailed"] | None = None
    theme: Literal["light", "dark"] | None = None

    model_config = {"extra": "forbid"}


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=86400,
        path="/",
    )


@router.post("/register", status_code=201)
def auth_register(payload: RegisterRequest, response: Response):
    try:
        result = register_member(
            email=payload.email,
            password=payload.password,
            name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        if "email_already_exists" in str(exc):
            raise HTTPException(
                status_code=400,
                detail="此電子郵件已被使用，請直接登入或使用其他信箱。",
            )
        raise HTTPException(status_code=500, detail="資料庫錯誤，請稍後再試。")

    token = create_access_token(member_id=result["member_id"], email=result["email"])
    member = _normalize_member(
        {
            "id": result["member_id"],
            "email": result["email"],
            "name": result["name"],
            "role": result.get("role"),
        }
    )
    _set_auth_cookie(response, token)
    return {"success": True, "member": member}


@router.post("/login")
def auth_login(payload: LoginRequest, response: Response):
    member = login_member(email=payload.email, password=payload.password)
    if member is None:
        raise HTTPException(status_code=401, detail="電子郵件或密碼錯誤，請重新輸入。")

    member = _normalize_member(member)
    token = create_access_token(member_id=member["id"], email=member["email"])
    _set_auth_cookie(response, token)
    return {"success": True, "member": member}


@router.post("/logout")
def auth_logout(response: Response):
    response.delete_cookie(
        "access_token",
        path="/",
        secure=True,
        samesite="none",
    )
    return {"success": True}


@router.patch("/profile")
def auth_update_profile(
    payload: UpdateProfileRequest,
    member_id: int = Depends(_get_current_member_id),
):
    try:
        updated = update_member_profile(
            member_id=member_id,
            name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"success": True, "member": _normalize_member(updated)}


@router.get("/me")
def auth_me(member_id: int = Depends(_get_current_member_id)):
    member = get_member_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="找不到會員資料。")
    return _normalize_member(member)


@router.get("/preferences")
def auth_get_preferences(member_id: int = Depends(_get_current_member_id)):
    return get_preferences(member_id)


@router.patch("/preferences")
def auth_update_preferences(
    payload: UpdatePreferencesRequest,
    member_id: int = Depends(_get_current_member_id),
):
    patch = payload.model_dump(exclude_unset=True)
    try:
        return update_preferences(member_id, patch)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.patch("/password")
def auth_change_password(
    payload: ChangePasswordRequest,
    member_id: int = Depends(_get_current_member_id),
):
    try:
        change_password(
            member_id=member_id,
            old_password=payload.old_password,
            new_password=payload.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError:
        raise HTTPException(status_code=404, detail="找不到會員資料。")
    return {"success": True}
