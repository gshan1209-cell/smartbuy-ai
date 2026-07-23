from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request

from src.data.auth_utils import decode_access_token
from src.data.member_repository import get_member_by_id

ROLES = frozenset({"consumer", "farmer", "merchant", "admin"})
ROLE_PERMISSIONS = {
    "consumer": frozenset(),
    "farmer": frozenset(
        {
            "dashboard.view",
            "prices.view",
            "predictions.view",
            "weather.view",
            "seasonal.view",
        }
    ),
    "merchant": frozenset(
        {
            "dashboard.view",
            "prices.view",
            "products.view",
            "predictions.view",
            "seasonal.view",
        }
    ),
    "admin": frozenset(
        {
            "dashboard.view",
            "prices.view",
            "products.view",
            "predictions.view",
            "weather.view",
            "seasonal.view",
            "content.manage",
            "mutualAid.manage",
            "members.manage",
            "notifications.manage",
            "dataJobs.view",
            "system.manage",
        }
    ),
}
ALL_PERMISSIONS = frozenset().union(*ROLE_PERMISSIONS.values())


def normalize_role(role: str | None) -> str:
    """Normalize persisted or external role values using least privilege."""
    return role if role in ROLES else "consumer"


def permissions_for_role(role: str | None) -> list[str]:
    return sorted(ROLE_PERMISSIONS[normalize_role(role)])


def _get_current_member_id(request: Request) -> int:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="請先登入。")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token 無效或已過期，請重新登入。")

    member_id = payload.get("member_id")
    if member_id is None:
        raise HTTPException(status_code=401, detail="Token 缺少會員資訊。")
    return int(member_id)


def get_current_member(member_id: int = Depends(_get_current_member_id)) -> dict:
    member = get_member_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=401, detail="找不到登入會員。")
    return {**member, "role": normalize_role(member.get("role"))}


def require_roles(*roles: str) -> Callable:
    invalid_roles = set(roles) - ROLES
    if invalid_roles:
        raise ValueError(f"Unknown RBAC roles: {sorted(invalid_roles)}")

    allowed = frozenset(roles)

    def dependency(member: dict = Depends(get_current_member)) -> dict:
        if member["role"] not in allowed:
            raise HTTPException(status_code=403, detail="目前角色沒有使用此功能的權限。")
        return member

    return dependency


def require_permissions(*permissions: str) -> Callable:
    invalid_permissions = set(permissions) - ALL_PERMISSIONS
    if invalid_permissions:
        raise ValueError(f"Unknown RBAC permissions: {sorted(invalid_permissions)}")

    required = frozenset(permissions)

    def dependency(member: dict = Depends(get_current_member)) -> dict:
        granted = ROLE_PERMISSIONS[member["role"]]
        if not required.issubset(granted):
            raise HTTPException(status_code=403, detail="目前角色沒有使用此功能的權限。")
        return member

    return dependency
