"""AI 推薦 API：只提供分類讀取與快取優先的推薦讀取。"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.security.roles import require_permissions
from src.recommendation.cache_repository import CacheBackendError, CacheCorruptError, CacheWriteError
from src.recommendation.category_catalog import UnknownRecommendationCategory, list_categories
from src.recommendation.recommendation_service import (
    RecommendationDataUnavailable,
    RecommendationService,
    RecommendationSourceUnavailable,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])
_service: RecommendationService | None = None


def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        try:
            _service = RecommendationService.from_environment()
        except Exception as exc:
            logger.error("recommendation_service_configuration_failed", extra={"error_type": type(exc).__name__})
            raise HTTPException(status_code=503, detail="AI 推薦快取服務尚未完成環境設定。") from exc
    return _service


@router.get("/categories")
def recommendation_categories(member: dict = Depends(require_permissions("recommendations.view"))):
    return {"categories": list_categories()}


@router.get("")
def recommendation_for_category(
    category: str = Query(min_length=1, max_length=64),
    member: dict = Depends(require_permissions("recommendations.view")),
    service: RecommendationService = Depends(get_recommendation_service),
):
    try:
        return service.get_recommendation(category).as_response()
    except UnknownRecommendationCategory as exc:
        raise HTTPException(status_code=422, detail="不支援的推薦分類。") from exc
    except CacheCorruptError as exc:
        raise HTTPException(status_code=500, detail="推薦 JSON 快取損壞，請由管理者修復後再讀取。") from exc
    except CacheBackendError as exc:
        raise HTTPException(status_code=500, detail="推薦快取目前無法讀取。") from exc
    except CacheWriteError as exc:
        raise HTTPException(status_code=503, detail="推薦已產生但無法持久保存，未回報為快取成功。") from exc
    except (RecommendationSourceUnavailable, RecommendationDataUnavailable) as exc:
        raise HTTPException(status_code=503, detail="目前沒有足夠的正式行情資料完成推薦。") from exc
