from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers import rewards
from backend.security.roles import get_current_member
from src.data import rewards_repository


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


def _client_for_role(monkeypatch, role: str) -> TestClient:
    monkeypatch.setattr(rewards, "list_coupons_for_admin", lambda: [])
    app = FastAPI()
    app.include_router(rewards.router)
    app.dependency_overrides[get_current_member] = lambda: {
        "id": 1,
        "email": "rewards@example.test",
        "name": "Rewards Test",
        "role": role,
    }
    return TestClient(app)


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


def test_nullable_coupon_fields_can_be_cleared(monkeypatch):
    _install_coupon(monkeypatch)

    patch = rewards._validated_coupon_patch(
        7,
        rewards.CouponUpdate(description=None, expires_at=None, stock=None),
    )

    assert patch == {"description": None, "expires_at": None, "stock": None}
    rewards_repository._validate_coupon_values(patch, partial=True)


def test_missing_coupon_raises_lookup_error(monkeypatch):
    monkeypatch.setattr(rewards, "list_coupons_for_admin", lambda: [])

    with pytest.raises(LookupError, match="coupon_not_found"):
        rewards._validated_coupon_patch(999, rewards.CouponUpdate(status="paused"))


def test_rewards_repository_reuses_project_engine(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(rewards_repository, "get_db_engine", lambda: sentinel)

    assert rewards_repository._get_engine() is sentinel


def test_rewards_repository_requires_database_url(monkeypatch):
    monkeypatch.setattr(rewards_repository, "get_db_engine", lambda: None)

    with pytest.raises(RuntimeError, match="DATABASE_URL 未設定"):
        rewards_repository._get_engine()


@pytest.mark.parametrize("role", ["consumer", "farmer", "merchant"])
def test_coupon_management_api_rejects_non_admin_roles(monkeypatch, role):
    response = _client_for_role(monkeypatch, role).get("/api/admin/coupons")
    assert response.status_code == 403


def test_coupon_management_api_allows_admin(monkeypatch):
    response = _client_for_role(monkeypatch, "admin").get("/api/admin/coupons")
    assert response.status_code == 200
    assert response.json() == []
