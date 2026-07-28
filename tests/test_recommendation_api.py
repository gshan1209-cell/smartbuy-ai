from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from backend.routers.recommendations import get_recommendation_service, router
from src.recommendation.recommendation_service import RecommendationService
from src.recommendation.role_prompts import PROMPT_SET_VERSION, ROLE_KEYS

from test_recommendation_cache import CountingLLM, FakeCacheRepository, prices


def _service():
    return RecommendationService(FakeCacheRepository(), CountingLLM(), price_loader=prices)


def _client_for_role(role: str | None, service: RecommendationService | None = None):
    app = FastAPI()
    app.include_router(router)
    # 推薦端點為公開讀取；role 參數保留用來明確驗證各身分邊界皆不影響結果。
    if service is not None:
        app.dependency_overrides[get_recommendation_service] = lambda: service
    return TestClient(app)


def test_unauthenticated_categories_are_public():
    response = _client_for_role(None).get("/api/recommendations/categories")
    assert response.status_code == 200
    assert len(response.json()["categories"]) >= 5


def test_consumer_can_access_recommendations():
    response = _client_for_role("consumer").get("/api/recommendations/categories")
    assert response.status_code == 200


@pytest.mark.parametrize("role", ["farmer", "merchant", "admin", "unknown"])
def test_all_authenticated_roles_can_access_public_recommendations(role):
    response = _client_for_role(role, _service()).get("/api/recommendations/categories")
    assert response.status_code == 200
    assert len(response.json()["categories"]) >= 5


def test_unauthenticated_api_exposes_three_role_payload_cache_observability_and_compatibility_alias():
    response = _client_for_role(None, _service()).get(
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
    invalid = _client_for_role(None, _service()).get(
        "/api/recommendations?category=unknown"
    )
    assert invalid.status_code == 422


def test_api_can_select_a_formal_role_without_changing_three_role_generation_contract():
    response = _client_for_role(None, _service()).get(
        "/api/recommendations?category=leafy-vegetables&role=farmer"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["selected_role"] == "farmer"
    assert payload["selected_recommendation"] == payload["role_recommendations"]["farmer"]
    assert payload["data"]["selected_role"] == "farmer"


def test_api_scopes_recommendation_to_region_and_market():
    response = _client_for_role(None, _service()).get(
        "/api/recommendations?category=leafy-vegetables&region=north&market=%E5%8F%B0%E5%8C%97%E4%B8%80"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["filters"] == {"region": "north", "market": "台北一"}
    assert payload["data"]["region"] == "north"
    assert payload["data"]["market"] == "台北一"


def test_api_rejects_market_outside_selected_region():
    response = _client_for_role(None, _service()).get(
        "/api/recommendations?category=leafy-vegetables&region=north&market=%E5%8F%B0%E4%B8%AD%E4%B8%80"
    )

    assert response.status_code == 422


def test_api_rejects_unknown_recommendation_role():
    invalid = _client_for_role(None, _service()).get(
        "/api/recommendations?category=leafy-vegetables&role=admin"
    )
    assert invalid.status_code == 422
