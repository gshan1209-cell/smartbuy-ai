from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers.admin import router as admin_router
from backend.security.roles import (
    ROLE_PERMISSIONS,
    get_current_member,
    normalize_role,
    permissions_for_role,
    require_permissions,
    require_roles,
)


def test_only_four_roles_are_normalized_as_valid():
    for role in ("consumer", "farmer", "merchant", "admin"):
        assert normalize_role(role) == role

    assert normalize_role("operator") == "consumer"
    assert normalize_role("staff") == "consumer"
    assert normalize_role(None) == "consumer"


def test_permission_matrix_matches_four_role_contract():
    assert ROLE_PERMISSIONS["consumer"] == frozenset()
    assert "prices.view" in ROLE_PERMISSIONS["farmer"]
    assert "products.view" not in ROLE_PERMISSIONS["farmer"]
    assert "products.view" in ROLE_PERMISSIONS["merchant"]
    assert "weather.view" not in ROLE_PERMISSIONS["merchant"]
    assert "members.manage" in ROLE_PERMISSIONS["admin"]


def test_unknown_required_role_fails_closed_during_configuration():
    with pytest.raises(ValueError, match="Unknown RBAC roles"):
        require_roles("operator")


def test_unknown_required_permission_fails_closed_during_configuration():
    with pytest.raises(ValueError, match="Unknown RBAC permissions"):
        require_permissions("unknown.manage")


def _client_for_role(role: str) -> TestClient:
    app = FastAPI()
    app.include_router(admin_router)
    app.dependency_overrides[get_current_member] = lambda: {
        "id": 1,
        "email": "rbac@example.test",
        "name": "RBAC Test",
        "role": role,
    }
    return TestClient(app)


def test_consumer_cannot_access_dashboard_access_endpoint():
    response = _client_for_role("consumer").get("/api/admin/access")
    assert response.status_code == 403


@pytest.mark.parametrize("role", ["farmer", "merchant", "admin"])
def test_authorized_roles_receive_permissions(role: str):
    response = _client_for_role(role).get("/api/admin/access")
    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == role
    assert payload["dashboardAccess"] is True
    assert payload["permissions"] == permissions_for_role(role)


@pytest.mark.parametrize("role", ["farmer", "admin"])
def test_weather_status_endpoint_allowed_for_farmer_and_admin(role: str):
    response = _client_for_role(role).get("/api/admin/weather/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["available"] is False
    assert payload["status"] == "unavailable"
    assert "capabilities" in payload


@pytest.mark.parametrize("role", ["consumer", "merchant"])
def test_weather_status_endpoint_forbidden_for_consumer_and_merchant(role: str):
    response = _client_for_role(role).get("/api/admin/weather/status")
    assert response.status_code == 403
