"""推薦快取 JSON 的 Pydantic schema。"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .category_catalog import SCHEMA_VERSION


class CategoryInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    description: str


class SourceSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_count: int = Field(ge=0)
    latest_trade_date: str | None = None
    historical_data: bool = False
    data_status: str = "unavailable"
    source_name: str | None = None


class RecommendationItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_name: str
    market_name: str | None = None
    price_status: Literal["便宜", "正常", "偏貴", "資料不足"]
    today_price: float | None = None
    recent_average: float | None = None
    action: str
    reason: str
    priority: Literal["high", "medium", "low"]
    substitute: str | None = None


class RecommendationContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    market_outlook: str
    shopping_strategy: str
    items: list[RecommendationItem] = Field(default_factory=list, max_length=6)


class RecommendationDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = SCHEMA_VERSION
    cache_key: str
    category: CategoryInfo
    generated_at: datetime
    generator: Literal["llm", "rules-fallback"]
    provider: str | None = None
    model: str | None = None
    input_digest: str
    source_summary: SourceSummary
    recommendation: RecommendationContent

    @field_validator("schema_version")
    @classmethod
    def validate_schema_version(cls, value: int) -> int:
        if value != SCHEMA_VERSION:
            raise ValueError(f"不支援的推薦快取 schema version: {value}")
        return value

    @field_validator("generated_at")
    @classmethod
    def validate_utc_datetime(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("generated_at 必須包含 UTC 時區")
        return value.astimezone(timezone.utc)
