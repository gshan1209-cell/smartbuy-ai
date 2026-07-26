from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from backend.routers.recommendations import get_recommendation_service, router
from backend.security.roles import get_current_member
from src.recommendation.recommendation_service import RecommendationService
from src.recommendation.role_prompts import PROMPT_SET_VERSION, ROLE_KEYS

from test_recommendation_cache import CountingLLM, FakeCacheRepository, prices


def _service():
    return RecommendationService(FakeCacheRepository(), CountingLLM(), price_loader=prices)


def _client_for_role(role: str | None, service: RecommendationService | None = None):
    app = FastAPI()
    app.include_router(router)
    if role is not None:
        app.dependency_overrides[get_current_member] = lambda: {
            "id": 1,
            "email": "recommendation@example.test",
            "name": "Recommendation Test",
            "role": role,
        }
    if service is not None:
        app.dependency_overrides[get_recommendation_service] = lambda: service
    return TestClient(app)


def test_unauthenticated_categories_are_rejected():
    response = _client_for_role(None).get("/api/recommendations/categories")
    assert response.status_code == 401


def test_consumer_cannot_access_recommendations():
    response = _client_for_role("consumer").get("/api/recommendations/categories")
    assert response.status_code == 403


@pytest.mark.parametrize("role", ["farmer", "merchant", "admin"])
def test_farmer_merchant_admin_can_access_recommendations(role):
    response = _client_for_role(role, _service()).get("/api/recommendations/categories")
    assert response.status_code == 200
    assert len(response.json()["categories"]) >= 5


def test_api_exposes_three_role_payload_cache_observability_and_compatibility_alias():
    response = _client_for_role("admin", _service()).get(
        "/api/recommendations?category=leafy-vegetables"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["cache_hit"] is False
    assert payload["llm_called"] is True
    assert payload["generation_source"] == "llm"
    assert payload["cache_backend"] == "r2"
    assert payload["prompt_set_version"] == PROMPT_SET_VERSION
    assert "generated_at" in payload
    assert payload["data"]["cache_key"] == "leafy-vegetables"
    assert set(payload["role_recommendations"]) == set(ROLE_KEYS)
    assert payload["data"]["recommendation"] == payload["role_recommendations"]["consumer"]
    assert payload["recommendations"] == payload["role_recommendations"]["consumer"]["items"]


def test_api_rejects_unknown_category():
    invalid = _client_for_role("admin", _service()).get(
        "/api/recommendations?category=unknown"
    )
    assert invalid.status_code == 422
