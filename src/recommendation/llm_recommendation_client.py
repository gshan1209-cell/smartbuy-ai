"""可替換的 OpenAI-compatible LLM Client。"""
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

    def generate(self, prompt: str) -> dict: ...


class OpenAICompatibleRecommendationClient:
    """Call a chat-completions compatible provider without leaking provider SDKs."""

    provider = "openai-compatible"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
        session=requests,
    ):
        self.provider = os.getenv("RECOMMENDATION_LLM_PROVIDER", "openai-compatible")
        self.api_key = api_key or os.getenv("RECOMMENDATION_LLM_API_KEY")
        self.model = model or os.getenv("RECOMMENDATION_LLM_MODEL", "gpt-4o-mini")
        self.base_url = (base_url or os.getenv("RECOMMENDATION_LLM_BASE_URL", "https://api.openai.com/v1")).rstrip("/")
        configured_timeout = timeout_seconds or float(os.getenv("RECOMMENDATION_LLM_TIMEOUT_SECONDS", "45"))
        self.timeout_seconds = max(1.0, min(configured_timeout, 120.0))
        self.session = session

    def generate(self, prompt: str) -> dict:
        if not self.api_key:
            raise RecommendationLLMError("推薦 LLM 尚未設定 API key")

        try:
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
        if not isinstance(payload, dict):
            raise RecommendationLLMError("推薦 LLM 回傳必須是 JSON object")
        return payload
