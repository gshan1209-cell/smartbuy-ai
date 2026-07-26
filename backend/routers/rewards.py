from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend.routers.auth import _get_current_member_id, _get_current_member_id_optional
from backend.security.roles import require_permissions
from src.data.rewards_repository import (
    create_coupon,
    get_points_summary,
    list_available_coupons,
    list_coupons_for_admin,
    list_member_coupons,
    redeem_coupon,
    update_coupon,
)

router = APIRouter(tags=["rewards"])


class CouponCreate(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    points_cost: int = Field(gt=0)
    discount_type: Literal["fixed", "percent"]
    discount_value: float = Field(gt=0)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    stock: int | None = Field(default=None, gt=0)
    status: Literal["draft", "active", "paused", "expired"] = "draft"

    @model_validator(mode="after")
    def validate_dates_and_discount(self):
        if self.expires_at and self.starts_at and self.expires_at <= self.starts_at:
            raise ValueError("結束時間必須晚於開始時間。")
        if self.discount_type == "percent" and self.discount_value > 100:
            raise ValueError("百分比折扣不可超過 100。")
        return self

    model_config = {"extra": "forbid"}


class CouponUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=40)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    points_cost: int | None = Field(default=None, gt=0)
    discount_type: Literal["fixed", "percent"] | None = None
    discount_value: float | None = Field(default=None, gt=0)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    stock: int | None = Field(default=None, gt=0)
    status: Literal["draft", "active", "paused", "expired"] | None = None

    @model_validator(mode="after")
    def validate_discount(self):
        if self.discount_type == "percent" and self.discount_value is not None and self.discount_value > 100:
            raise ValueError("百分比折扣不可超過 100。")
        if self.expires_at and self.starts_at and self.expires_at <= self.starts_at:
            raise ValueError("結束時間必須晚於開始時間。")
        return self

    model_config = {"extra": "forbid"}


def _parse_coupon_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _validated_coupon_patch(coupon_id: int, payload: CouponUpdate) -> dict:
    """Merge a partial PATCH with persisted values before cross-field validation."""
    existing = next(
        (coupon for coupon in list_coupons_for_admin() if coupon["id"] == coupon_id),
        None,
    )
    if existing is None:
        raise LookupError("coupon_not_found")

    patch = payload.model_dump(exclude_unset=True)
    merged = {**existing, **patch}

    if merged["discount_type"] == "percent" and merged["discount_value"] > 100:
        raise ValueError("百分比折扣不可超過 100。")

    starts_at = _parse_coupon_datetime(merged.get("starts_at"))
    expires_at = _parse_coupon_datetime(merged.get("expires_at"))
    if starts_at and expires_at and expires_at <= starts_at:
        raise ValueError("結束時間必須晚於開始時間。")

    stock = merged.get("stock")
    redeemed_count = int(existing.get("redeemed_count") or 0)
    if stock is not None and stock < redeemed_count:
        raise ValueError("庫存不可低於已兌換數量。")

    return patch


def _handle_error(exc: Exception):
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=422, detail=str(exc))
    if isinstance(exc, LookupError):
        raise HTTPException(status_code=404, detail="找不到指定的優惠券。")
    raise exc


@router.get("/api/points")
def points_summary(member_id: int = Depends(_get_current_member_id)):
    return get_points_summary(member_id)


@router.get("/api/coupons")
def coupons_list(member_id: int | None = Depends(_get_current_member_id_optional)):
    return list_available_coupons(member_id)


@router.get("/api/coupons/mine")
def coupons_mine(member_id: int = Depends(_get_current_member_id)):
    return list_member_coupons(member_id)


@router.post("/api/coupons/{coupon_id}/redeem")
def coupon_redeem(coupon_id: int, member_id: int = Depends(_get_current_member_id)):
    try:
        return redeem_coupon(member_id, coupon_id)
    except (ValueError, LookupError) as exc:
        _handle_error(exc)


@router.get("/api/admin/coupons")
def admin_coupons_list(member: dict = Depends(require_permissions("coupons.manage"))):
    return list_coupons_for_admin()


@router.post("/api/admin/coupons", status_code=201)
def admin_coupon_create(payload: CouponCreate, member: dict = Depends(require_permissions("coupons.manage"))):
    try:
        return create_coupon(**payload.model_dump())
    except (ValueError, LookupError) as exc:
        _handle_error(exc)


@router.patch("/api/admin/coupons/{coupon_id}")
def admin_coupon_update(
    coupon_id: int,
    payload: CouponUpdate,
    member: dict = Depends(require_permissions("coupons.manage")),
):
    try:
        patch = _validated_coupon_patch(coupon_id, payload)
        return update_coupon(coupon_id, patch)
    except (ValueError, LookupError) as exc:
        _handle_error(exc)
