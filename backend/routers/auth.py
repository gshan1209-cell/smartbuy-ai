from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.db import get_session
from backend.auth_utils import hash_password, verify_password, create_access_token
from backend.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileBody(BaseModel):
    name: str


def _user_response(token: str, user_id: str, email: str, name: str, plan: str = "免費會員") -> dict:
    return {
        "token": token,
        "user": {"id": user_id, "email": email, "name": name, "plan": plan},
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, db: Session = Depends(get_session)):
    existing = db.execute(
        text("SELECT id FROM members WHERE email = :email"),
        {"email": body.email},
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="此 Email 已被註冊")

    result = db.execute(
        text(
            "INSERT INTO members (email, name, password_hash) "
            "VALUES (:email, :name, :pw) RETURNING id, plan"
        ),
        {"email": body.email, "name": body.name, "pw": hash_password(body.password)},
    )
    row = result.fetchone()

    db.execute(
        text("INSERT INTO user_preferences (member_id) VALUES (:mid)"),
        {"mid": row.id},
    )
    db.commit()

    token = create_access_token(str(row.id))
    return _user_response(token, str(row.id), body.email, body.name, row.plan)


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_session)):
    row = db.execute(
        text("SELECT id, name, plan, password_hash FROM members WHERE email = :email"),
        {"email": body.email},
    ).fetchone()

    if row is None or not verify_password(body.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Email 或密碼錯誤")

    token = create_access_token(str(row.id))
    return _user_response(token, str(row.id), body.email, row.name, row.plan)


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/me")
def update_me(
    body: UpdateProfileBody,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="名稱不能為空")

    db.execute(
        text("UPDATE members SET name = :name WHERE id = :id"),
        {"name": body.name.strip(), "id": current_user["id"]},
    )
    db.commit()
    return {**current_user, "name": body.name.strip()}
