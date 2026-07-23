from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from src.data.member_repository import get_member_by_id
from backend.routers.auth import _get_current_member_id

ROLES = frozenset({'consumer', 'farmer', 'merchant', 'admin'})
ROLE_PERMISSIONS = {
    'consumer': frozenset(),
    'farmer': frozenset({'dashboard.view', 'prices.view', 'predictions.view', 'weather.view', 'seasonal.view'}),
    'merchant': frozenset({'dashboard.view', 'prices.view', 'products.view', 'predictions.view', 'seasonal.view'}),
    'admin': frozenset({'dashboard.view', 'prices.view', 'products.view', 'predictions.view', 'weather.view', 'seasonal.view', 'content.manage', 'mutualAid.manage', 'members.manage', 'notifications.manage', 'dataJobs.view', 'system.manage'}),
}

def normalize_role(role: str | None) -> str:
    return role if role in ROLES else 'consumer'

def permissions_for_role(role: str | None) -> list[str]:
    return sorted(ROLE_PERMISSIONS[normalize_role(role)])

def get_current_member(member_id: int = Depends(_get_current_member_id)):
    member = get_member_by_id(member_id)
    if member is None:
        raise HTTPException(status_code=401, detail='找不到登入會員。')
    return {**member, 'role': normalize_role(member.get('role'))}

def require_roles(*roles: str):
    allowed = {normalize_role(role) for role in roles}
    def dependency(member = Depends(get_current_member)):
        if member['role'] not in allowed:
            raise HTTPException(status_code=403, detail='目前角色沒有使用此功能的權限。')
        return member
    return dependency

def require_permissions(*permissions: str):
    def dependency(member = Depends(get_current_member)):
        granted = ROLE_PERMISSIONS[member['role']]
        if not set(permissions).issubset(granted):
            raise HTTPException(status_code=403, detail='目前角色沒有使用此功能的權限。')
        return member
    return dependency
