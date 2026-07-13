from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

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


class UpdatePreferencesBody(BaseModel):
    priceAlert: Optional[bool] = None
    weatherAlert: Optional[bool] = None
    mutualAidReply: Optional[bool] = None
    fontSize: Optional[str] = None
    layout: Optional[str] = None
    theme: Optional[str] = None


def _user_response(token: str, user_id: str, email: str, name: str, plan: str = "免費會員") -> dict:
    return {
        "token": token,
        "user": {"id": user_id, "email": email, "name": name, "plan": plan},
    }


def _model_payload(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=True)
    return model.dict(exclude_unset=True)


def _preferences_response(row) -> dict:
    return {
        "priceAlert": row.price_alert,
        "weatherAlert": row.weather_alert,
        "mutualAidReply": row.mutual_aid_reply,
        "fontSize": row.font_size,
        "layout": row.layout_mode,
        "theme": row.theme,
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


@router.get("/preferences")
def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    row = db.execute(
        text(
            """
            SELECT
                price_alert,
                weather_alert,
                mutual_aid_reply,
                font_size,
                layout_mode,
                theme
            FROM user_preferences
            WHERE member_id = :id
            LIMIT 1
            """
        ),
        {"id": current_user["id"]},
    ).fetchone()

    if row is None:
        row = db.execute(
            text(
                """
                INSERT INTO user_preferences (member_id)
                VALUES (:id)
                RETURNING
                    price_alert,
                    weather_alert,
                    mutual_aid_reply,
                    font_size,
                    layout_mode,
                    theme
                """
            ),
            {"id": current_user["id"]},
        ).fetchone()
        db.commit()

    return _preferences_response(row)


@router.put("/preferences")
def update_preferences(
    body: UpdatePreferencesBody,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    payload = _model_payload(body)
    if "fontSize" in payload and payload["fontSize"] not in {"sm", "md", "lg"}:
        raise HTTPException(status_code=422, detail="fontSize must be one of: sm, md, lg")
    if "layout" in payload and payload["layout"] not in {"simple", "detailed"}:
        raise HTTPException(status_code=422, detail="layout must be one of: simple, detailed")
    if "theme" in payload and payload["theme"] not in {"light", "dark"}:
        raise HTTPException(status_code=422, detail="theme must be one of: light, dark")

    db.execute(
        text(
            """
            INSERT INTO user_preferences (member_id)
            SELECT :id
            WHERE NOT EXISTS (
                SELECT 1
                FROM user_preferences
                WHERE member_id = :id
            )
            """
        ),
        {"id": current_user["id"]},
    )

    assignments = []
    params = {"id": current_user["id"]}
    field_map = {
        "priceAlert": "price_alert",
        "weatherAlert": "weather_alert",
        "mutualAidReply": "mutual_aid_reply",
        "fontSize": "font_size",
        "layout": "layout_mode",
        "theme": "theme",
    }

    for api_field, db_field in field_map.items():
        if api_field in payload:
            assignments.append(f"{db_field} = :{api_field}")
            params[api_field] = payload[api_field]

    if assignments:
        db.execute(
            text(
                f"""
                UPDATE user_preferences
                SET {', '.join(assignments)}
                WHERE member_id = :id
                """
            ),
            params,
        )

    row = db.execute(
        text(
            """
            SELECT
                price_alert,
                weather_alert,
                mutual_aid_reply,
                font_size,
                layout_mode,
                theme
            FROM user_preferences
            WHERE member_id = :id
            LIMIT 1
            """
        ),
        {"id": current_user["id"]},
    ).fetchone()
    db.commit()

    return _preferences_response(row)
