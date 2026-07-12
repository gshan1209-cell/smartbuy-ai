# -*- coding: utf-8 -*-
"""
單元測試: tests.test_prediction_direction_api
功能說明: 驗證 FastAPI 方向預測端點會呼叫正式 D06 store，且查無資料時回傳 404。
"""
from __future__ import annotations

import sys
import types

from fastapi.testclient import TestClient

fake_db = types.ModuleType("backend.db")
fake_db.get_session = lambda: None
sys.modules.setdefault("backend.db", fake_db)

import backend.main as main


def test_prediction_direction_latest_api_returns_batch_prediction(monkeypatch):
    """測試單筆方向預測 API 回傳 price_direction_predictions 格式資料。"""
    expected = {
        "market_id": "104",
        "market_name": "台北二",
        "crop_id": "11",
        "crop_name": "椰子",
        "base_date": "2026-07-10",
        "global_latest_trade_date": "2026-07-10",
        "data_staleness_days": 0,
        "prediction_target": "next_trade_day",
        "pred_label_direction": 1,
        "pred_label_name": "漲",
        "prob_down": 0.1,
        "prob_flat": 0.2,
        "prob_up": 0.7,
        "pred_confidence": 0.7,
        "confidence_level": "中",
        "risk_level": "normal",
        "risk_note": "一般風險",
        "display_message": "台北二 / 椰子：下一個交易日預測漲，信心 中",
        "model_type": "fake_lightgbm_direction_model",
        "payload_version": "v1",
        "prepared_at": "2026-07-10T00:00:00+00:00",
    }

    def fake_query_latest_prediction(**kwargs):
        assert kwargs["crop_id"] == "11"
        assert kwargs["market_id"] == "104"
        return expected

    monkeypatch.setattr(main, "query_latest_prediction", fake_query_latest_prediction)
    client = TestClient(main.app)

    response = client.get("/api/predictions/direction/latest?crop_id=11&market_id=104")

    assert response.status_code == 200
    assert response.json() == expected


def test_prediction_direction_latest_api_returns_404_when_missing(monkeypatch):
    """測試查無方向預測時不 fallback 舊版 prediction_results。"""
    monkeypatch.setattr(main, "query_latest_prediction", lambda **kwargs: None)
    client = TestClient(main.app)

    response = client.get("/api/predictions/direction/latest?crop_name=椰子")

    assert response.status_code == 404
    assert response.json()["detail"] == "查無此品項的每日方向預測"
