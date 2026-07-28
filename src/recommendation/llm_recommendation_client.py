"""可替換的推薦 LLM client（Gemini 與 OpenAI-compatible）。"""
from __future__ import annotations

import json
import os
from typing import Protocol

import requests


class RecommendationLLMError(RuntimeError):
    """LLM unavailable, timed out, or returned an invalid response."""


class RecommendationLLMClient(Protocol):
    provider: str
    model: str

    def generate(self, prompt: str) -> dict | list: ...


class OpenAICompatibleRecommendationClient:
    """Call Gemini or a chat-completions compatible provider.

    Gemini is selected with ``RECOMMENDATION_LLM_PROVIDER=gemini`` (or
    automatically when ``RECOMMENDATION_LLM_API_KEY`` is present and the provider is not
    explicitly configured).  The client intentionally uses REST rather than a
    provider SDK so the feature remains small and easy to fall back safely.
    """

    provider = "openai-compatible"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        session=requests,
    ):
        configured_provider = os.getenv("RECOMMENDATION_LLM_PROVIDER")
        provider = (
            configured_provider
            or ("gemini" if os.getenv("RECOMMENDATION_LLM_API_KEY") else "openai-compatible")
        ).strip().lower()
        self.provider = "gemini" if provider in {"gemini", "google", "google-gemini"} else provider

        if api_key:
            self.api_key = api_key
        elif self.provider == "gemini":
            # Use the feature-scoped key for every recommendation provider.
            # Keep the old Gemini name as a private backwards-compatible
            # fallback so existing local environments do not break abruptly.
            self.api_key = os.getenv("RECOMMENDATION_LLM_API_KEY") or os.getenv("GEMINI_API_KEY")
        else:
            # Prefer the feature-scoped key, but support the conventional
            # OpenAI environment variable so deployments do not need duplicate
            # secrets.
            self.api_key = os.getenv("RECOMMENDATION_LLM_API_KEY") or os.getenv("OPENAI_API_KEY")

        default_model = "gemini-2.5-flash" if self.provider == "gemini" else "gpt-4o-mini"
        default_base_url = (
            "https://generativelanguage.googleapis.com/v1beta"
            if self.provider == "gemini"
            else "https://api.openai.com/v1"
        )
        self.model = model or os.getenv("RECOMMENDATION_LLM_MODEL", default_model)
        self.base_url = (
            base_url or os.getenv("RECOMMENDATION_LLM_BASE_URL", default_base_url)
        ).rstrip("/")
        configured_timeout = timeout_seconds or float(os.getenv("RECOMMENDATION_LLM_TIMEOUT_SECONDS", "45"))
        self.timeout_seconds = max(1.0, min(configured_timeout, 120.0))
        self.session = session

    def generate(self, prompt: str) -> dict | list:
        if not self.api_key:
            raise RecommendationLLMError("推薦 LLM 尚未設定 API key")

        try:
            if self.provider == "gemini":
                response = self.session.post(
                    f"{self.base_url}/models/{self.model}:generateContent",
                    headers={
                        "x-goog-api-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "contents": [{
                            "parts": [{
                                "text": (
                                    "你是 SmartBuy AI 農產決策助手。只能依輸入行情與三套角色提示語，"
                                    "一次輸出 consumer、farmer、merchant 三份 JSON 建議；不得虛構資料。\n\n"
                                    f"{prompt}"
                                )
                            }]
                        }],
                        "generationConfig": {
                            "temperature": 0.2,
                            "response_mime_type": "application/json",
                        },
                    },
                    timeout=self.timeout_seconds,
                )
            else:
                response = self.session.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "你是 SmartBuy AI 農產決策助手。只能依輸入行情與三套角色提示語，"
                                    "一次輸出 consumer、farmer、merchant 三份 JSON 建議；不得虛構資料。"
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                    timeout=self.timeout_seconds,
                )
            response.raise_for_status()
            body = response.json()
            if self.provider == "gemini":
                parts = body["candidates"][0]["content"]["parts"]
                content = "".join(
                    part["text"]
                    for part in parts
                    if isinstance(part, dict) and isinstance(part.get("text"), str)
                )
            else:
                content = body["choices"][0]["message"]["content"]
        except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
            raise RecommendationLLMError("推薦 LLM 呼叫或回應解析失敗") from exc

        if isinstance(content, dict):
            return content
        if not isinstance(content, str):
            raise RecommendationLLMError("推薦 LLM 回傳格式不是 JSON 物件")
        text = content.strip()
        if text.startswith("```"):
            text = text.removeprefix("```").removeprefix("json").removesuffix("```").strip()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RecommendationLLMError("推薦 LLM 回傳不是合法 JSON") from exc
        if not isinstance(payload, (dict, list)):
            raise RecommendationLLMError("推薦 LLM 回傳必須是 JSON object 或 role array")
        return payload
