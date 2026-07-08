from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.db import get_session
from backend.auth_utils import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_session),
) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="無效的認證憑證",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_token(token)
    except ValueError:
        raise credentials_exception

    row = db.execute(
        text("SELECT id, email, name, plan FROM members WHERE id = :id"),
        {"id": user_id},
    ).fetchone()

    if row is None:
        raise credentials_exception

    return {"id": str(row.id), "email": row.email, "name": row.name, "plan": row.plan}
