# -*- coding: utf-8 -*-
"""
單元測試: tests.test_price_direction_prediction_store
功能說明: 驗證 D06 store 寫入前的 payload record 轉換，不連線真實 Supabase。
"""
from __future__ import annotations

import pandas as pd

from src.data.price_direction_prediction_store import _records_from_payload
from src.ml.price_direction_predictor import BASE_PAYLOAD_COLUMNS


def test_records_from_payload_converts_pandas_scalars():
    """測試 pandas / NumPy 型別會轉成 SQLAlchemy 可綁定的 Python 值。"""
    payload_df = pd.DataFrame(
        [
            {
                "upsert_key": "104__11__2026-07-10",
                "market_id": "104",
                "market_name": "台北二",
                "crop_id": "11",
                "crop_name": "椰子",
                "base_date": pd.Timestamp("2026-07-10"),
                "global_latest_trade_date": pd.Timestamp("2026-07-10"),
                "data_staleness_days": pd.Series([0], dtype="int64").iloc[0],
                "prediction_target": "next_trade_day",
                "pred_label_direction": pd.Series([1], dtype="int64").iloc[0],
                "pred_label_name": "漲",
                "prob_down": pd.Series([0.1], dtype="float64").iloc[0],
                "prob_flat": pd.Series([0.2], dtype="float64").iloc[0],
                "prob_up": pd.Series([0.7], dtype="float64").iloc[0],
                "pred_confidence": pd.Series([0.7], dtype="float64").iloc[0],
                "confidence_level": "中",
                "risk_level": "normal",
                "risk_note": pd.NA,
                "display_message": "台北二 / 椰子：下一個交易日預測漲，信心 中",
                "model_type": "fake_lightgbm_direction_model",
                "payload_version": "v1",
                "created_by_stage": "github_actions_price_direction_prediction",
                "prepared_at": pd.Timestamp("2026-07-10T00:00:00Z"),
            }
        ],
        columns=BASE_PAYLOAD_COLUMNS,
    )

    records = _records_from_payload(payload_df)

    assert len(records) == 1
    assert set(records[0]) == set(BASE_PAYLOAD_COLUMNS)
    assert records[0]["base_date"] == "2026-07-10T00:00:00"
    assert records[0]["risk_note"] is None
    assert isinstance(records[0]["data_staleness_days"], int)
    assert isinstance(records[0]["prob_up"], float)

