from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from src.data.member_repository import (
    register_member,
    login_member,
    update_member_profile,
    get_member_by_id,
)
from src.data.auth_utils import create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth")

_bearer_scheme = HTTPBearer(auto_error=False)


def _get_current_member_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> int:
    """
    FastAPI 依賴注入：從 Authorization: Bearer <token> 解出會員 ID。
    Token 無效或未提供時回傳 401。
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="請先登入。")
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token 無效或已過期，請重新登入。")
    return payload["member_id"]


class RegisterRequest(BaseModel):
    """會員申請表單欄位（不含 plan）。"""
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    """會員登入表單欄位。"""
    email: str
    password: str


class UpdateProfileRequest(BaseModel):
    """更新會員資料（name 選填）。"""
    name: str | None = None


@router.post("/register", status_code=201)
def auth_register(payload: RegisterRequest):
    """
    會員申請（註冊）。
    - 不需要傳入 plan；系統預設「免費會員」。
    - 密碼由後端 bcrypt 雜湊後存入。
    - 註冊成功後直接回傳 JWT Token，前端可免去二次登入。
    """
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
    member = {"id": result["member_id"], "email": result["email"], "name": result["name"]}
    return {"success": True, "token": token, "member": member}


@router.post("/login")
def auth_login(payload: LoginRequest):
    """
    會員登入。
    成功時回傳 JWT Token 與會員公開資訊（不含密碼雜湊）。
    """
    member = login_member(email=payload.email, password=payload.password)
    if member is None:
        raise HTTPException(status_code=401, detail="電子郵件或密碼錯誤，請重新輸入。")
    token = create_access_token(member_id=member["id"], email=member["email"])
    return {"success": True, "token": token, "member": member}


@router.patch("/profile")
def auth_update_profile(
    payload: UpdateProfileRequest,
    member_id: int = Depends(_get_current_member_id),
):
    """
    更新目前登入會員的顯示名稱。
    - 需在 Header 帶入 Authorization: Bearer <token>。
    - email 與 plan 不可透過此端點修改。
    """
    try:
        updated = update_member_profile(
            member_id=member_id,
            name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"success": True, "member": updated}


@router.get("/me")
def auth_me(member_id: int = Depends(_get_current_member_id)):
    """
    取得目前登入會員的公開資訊。
    - 需在 Header 帶入 Authorization: Bearer <token>。
    """
    member = get_member_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="找不到會員資料。")
    return member
