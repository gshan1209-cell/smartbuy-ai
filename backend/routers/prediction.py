from fastapi import APIRouter, Query, HTTPException
from src.data.price_direction_prediction_store import query_latest_prediction, query_prediction_list

router = APIRouter()


@router.get("/api/predictions/direction/latest")
def get_prediction_latest(
    crop_id: str = Query(default=""),
    market_id: str = Query(default=""),
    crop_name: str = Query(default=""),
    market_name: str = Query(default=""),
):
    """查詢單一市場作物最新每日批次方向預測。"""
    result = query_latest_prediction(
        crop_id=crop_id or None,
        market_id=market_id or None,
        crop_name=crop_name or None,
        market_name=market_name or None,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="查無此品項的每日方向預測")
    return result


@router.get("/api/predictions/direction")
def get_prediction_list(
    market_id: str = Query(default=""),
    direction: str = Query(default=""),
    risk: str = Query(default=""),
    limit: int = Query(default=100, ge=1, le=500),
):
    """查詢多筆每日批次方向預測列表。"""
    return query_prediction_list(
        market_id=market_id or None,
        direction=direction or None,
        risk=risk or None,
        limit=limit,
    )
