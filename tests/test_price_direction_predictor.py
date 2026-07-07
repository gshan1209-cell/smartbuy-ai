# -*- coding: utf-8 -*-
"""
單元測試: tests.test_price_direction_predictor
功能說明: 測試價格方向模型推論模組的特徵工程、payload 產生與驗證規則。
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import pytest

from src.ml.price_direction_predictor import (
    BASE_PAYLOAD_COLUMNS,
    predict_price_directions,
    validate_price_direction_payload,
)


class FakeDirectionModel:
    """測試用模型，固定回傳三類機率。"""

    def predict_proba(self, matrix):
        return [[0.1, 0.2, 0.7] for _ in range(len(matrix))]


def make_history(crop_code: str = "11", market_code: str = "104", rows: int = 18) -> pd.DataFrame:
    """建立足夠產生 lag 與 rolling feature 的歷史行情測試資料。"""
    start = date(2026, 6, 1)
    return pd.DataFrame(
        {
            "trans_date": [start + timedelta(days=i) for i in range(rows)],
            "market_code": [market_code] * rows,
            "market_name": ["台北二"] * rows,
            "crop_code": [crop_code] * rows,
            "crop_name": ["椰子"] * rows,
            "avg_price": [20.0 + i for i in range(rows)],
            "volume": [100.0 + i for i in range(rows)],
        }
    )


def make_model_payload() -> dict:
    """建立測試用模型 payload，模擬 joblib 內的必要欄位。"""
    feature_columns = [
        "market_id",
        "crop_id",
        "avg_price",
        "volume",
        "price_lag_1",
        "volume_lag_1",
        "price_return_1",
        "volume_change_1",
        "price_ma_7",
        "volume_ma_7",
        "price_std_7",
        "price_vs_ma_7",
        "volume_vs_ma_7",
        "day_of_week",
        "month",
    ]
    return {
        "model": FakeDirectionModel(),
        "model_type": "fake_lightgbm_direction_model",
        "model_feature_columns": feature_columns,
        "categorical_feature_columns": ["market_id", "crop_id"],
        "category_maps": {"market_id": ["104"], "crop_id": ["11"]},
    }


def test_predict_price_directions_builds_valid_payload():
    """測試完整歷史資料可產生符合 Supabase schema 的 payload。"""
    payload_df = predict_price_directions(
        history_df=make_history(),
        model_payload=make_model_payload(),
    )

    assert len(payload_df) == 1
    assert list(payload_df.columns) == BASE_PAYLOAD_COLUMNS
    assert payload_df.iloc[0]["upsert_key"].startswith("104__11__")
    assert payload_df.iloc[0]["pred_label_direction"] == 1
    assert payload_df.iloc[0]["pred_label_name"] == "漲"
    assert payload_df.iloc[0]["confidence_level"] == "中"
    assert payload_df.iloc[0]["risk_level"] == "normal"


def test_unknown_category_is_excluded():
    """測試訓練時沒看過的作物代碼會被排除，不產生 payload。"""
    payload_df = predict_price_directions(
        history_df=make_history(crop_code="999"),
        model_payload=make_model_payload(),
    )

    assert payload_df.empty
    assert list(payload_df.columns) == BASE_PAYLOAD_COLUMNS


def test_payload_validation_rejects_duplicate_upsert_key():
    """測試 payload 驗證會拒絕重複主鍵。"""
    payload_df = predict_price_directions(
        history_df=make_history(),
        model_payload=make_model_payload(),
    )
    duplicated = pd.concat([payload_df, payload_df], ignore_index=True)

    with pytest.raises(ValueError, match="upsert_key 不可重複"):
        validate_price_direction_payload(duplicated)
