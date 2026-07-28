from __future__ import annotations

import pytest

from src.recommendation.llm_recommendation_client import (
    OpenAICompatibleRecommendationClient,
    RecommendationLLMError,
)


class FakeResponse:
    def __init__(self, body: dict):
        self.body = body

    def raise_for_status(self):
        return None

    def json(self):
        return self.body


class FakeSession:
    def __init__(self, body: dict):
        self.body = body
        self.calls: list[dict] = []

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return FakeResponse(self.body)


def test_gemini_uses_gemini_api_key_and_generate_content_request(monkeypatch):
    monkeypatch.setenv("RECOMMENDATION_LLM_PROVIDER", "gemini")
    monkeypatch.setenv("RECOMMENDATION_LLM_API_KEY", "recommendation-test-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("RECOMMENDATION_LLM_BASE_URL", raising=False)
    monkeypatch.delenv("RECOMMENDATION_LLM_MODEL", raising=False)
    session = FakeSession({
        "candidates": [{
            "content": {"parts": [{"text": '{"consumer": {}}'}]},
        }],
    })

    client = OpenAICompatibleRecommendationClient(session=session)
    result = client.generate("請產生 JSON")

    assert result == {"consumer": {}}
    request = session.calls[0]
    assert request["url"] == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    assert request["headers"]["x-goog-api-key"] == "recommendation-test-key"
    assert "Authorization" not in request["headers"]
    assert request["json"]["contents"][0]["parts"][0]["text"].endswith("請產生 JSON")
    assert request["json"]["generationConfig"]["response_mime_type"] == "application/json"


def test_gemini_role_array_is_returned_for_service_normalization(monkeypatch):
    monkeypatch.setenv("RECOMMENDATION_LLM_PROVIDER", "gemini")
    monkeypatch.setenv("RECOMMENDATION_LLM_API_KEY", "recommendation-test-key")
    session = FakeSession({
        "candidates": [{
            "content": {"parts": [{"text": '[{"role":"consumer"}]'}]},
        }],
    })

    result = OpenAICompatibleRecommendationClient(session=session).generate("prompt")

    assert result == [{"role": "consumer"}]


def test_gemini_is_auto_selected_when_key_is_present(monkeypatch):
    monkeypatch.delenv("RECOMMENDATION_LLM_PROVIDER", raising=False)
    monkeypatch.setenv("RECOMMENDATION_LLM_API_KEY", "recommendation-test-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    client = OpenAICompatibleRecommendationClient(session=FakeSession({}))

    assert client.provider == "gemini"
    assert client.api_key == "recommendation-test-key"


def test_missing_gemini_key_fails_without_network_call(monkeypatch):
    monkeypatch.setenv("RECOMMENDATION_LLM_PROVIDER", "gemini")
    monkeypatch.delenv("RECOMMENDATION_LLM_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    session = FakeSession({})
    client = OpenAICompatibleRecommendationClient(session=session)

    with pytest.raises(RecommendationLLMError, match="API key"):
        client.generate("prompt")

    assert session.calls == []
