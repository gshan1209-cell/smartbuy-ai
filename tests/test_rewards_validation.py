from __future__ import annotations

from datetime import datetime

import pytest

from backend.routers import rewards


def _coupon(**overrides):
    coupon = {
        "id": 7,
        "code": "SAVE20",
        "title": "測試優惠券",
        "description": None,
        "points_cost": 100,
        "discount_type": "percent",
        "discount_value": 20.0,
        "starts_at": "2026-07-26T00:00:00+00:00",
        "expires_at": "2026-08-26T00:00:00+00:00",
        "stock": 10,
        "redeemed_count": 3,
        "status": "active",
        "created_at": "2026-07-26T00:00:00+00:00",
        "updated_at": "2026-07-26T00:00:00+00:00",
    }
    coupon.update(overrides)
    return coupon


def _install_coupon(monkeypatch, **overrides):
    monkeypatch.setattr(rewards, "list_coupons_for_admin", lambda: [_coupon(**overrides)])


def test_partial_percent_update_cannot_exceed_one_hundred(monkeypatch):
    _install_coupon(monkeypatch)

    with pytest.raises(ValueError, match="百分比折扣不可超過 100"):
        rewards._validated_coupon_patch(
            7,
            rewards.CouponUpdate(discount_value=150),
        )


def test_partial_expiry_update_is_checked_against_existing_start(monkeypatch):
    _install_coupon(monkeypatch)

    with pytest.raises(ValueError, match="結束時間必須晚於開始時間"):
        rewards._validated_coupon_patch(
            7,
            rewards.CouponUpdate(expires_at=datetime(2026, 7, 25, 23, 0, 0)),
        )


def test_stock_cannot_be_reduced_below_redeemed_count(monkeypatch):
    _install_coupon(monkeypatch)

    with pytest.raises(ValueError, match="庫存不可低於已兌換數量"):
        rewards._validated_coupon_patch(
            7,
            rewards.CouponUpdate(stock=2),
        )


def test_valid_partial_update_returns_only_submitted_fields(monkeypatch):
    _install_coupon(monkeypatch)

    patch = rewards._validated_coupon_patch(
        7,
        rewards.CouponUpdate(status="paused", discount_value=25),
    )

    assert patch == {"status": "paused", "discount_value": 25.0}


def test_missing_coupon_raises_lookup_error(monkeypatch):
    monkeypatch.setattr(rewards, "list_coupons_for_admin", lambda: [])

    with pytest.raises(LookupError, match="coupon_not_found"):
        rewards._validated_coupon_patch(999, rewards.CouponUpdate(status="paused"))
