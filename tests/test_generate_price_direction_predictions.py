# -*- coding: utf-8 -*-
"""
單元測試: tests.test_generate_price_direction_predictions
功能說明: 測試每日價格方向預測 CLI 的 dry-run 與正式寫入控制流程，避免測試時碰觸真實 Supabase。
"""
from __future__ import annotations

import sys
from datetime import date, timedelta

import pandas as pd

import scripts.generate_price_direction_predictions as script


class FakeDirectionModel:
    """測試用模型，固定回傳三類機率。"""

    def predict_proba(self, matrix):
        return [[0.1, 0.2, 0.7] for _ in range(len(matrix))]


def make_history(rows: int = 18) -> pd.DataFrame:
    """建立 CLI 測試用歷史行情資料。"""
    start = date(2026, 6, 1)
    return pd.DataFrame(
        {
            "trans_date": [start + timedelta(days=i) for i in range(rows)],
            "market_code": ["104"] * rows,
            "market_name": ["台北二"] * rows,
            "crop_code": ["11"] * rows,
            "crop_name": ["椰子"] * rows,
            "avg_price": [20.0 + i for i in range(rows)],
            "volume": [100.0 + i for i in range(rows)],
        }
    )


def make_model_payload() -> dict:
    """建立 CLI 測試用模型 payload。"""
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


def test_cli_dry_run_does_not_write(monkeypatch, tmp_path):
    """測試 dry-run 只產生與驗證 payload，不呼叫資料庫寫入。"""
    model_path = tmp_path / "model.joblib"
    model_path.write_bytes(b"fake")

    save_called = False

    def fake_save(payload_df):
        nonlocal save_called
        save_called = True
        return len(payload_df)

    monkeypatch.setattr(script, "load_historical_prices_for_ml", lambda: make_history())
    monkeypatch.setattr(script, "load_model_payload", lambda path: make_model_payload())
    monkeypatch.setattr(script, "read_pair_risk", lambda path: None)
    monkeypatch.setattr(script, "save_price_direction_predictions_to_supabase", fake_save)
    monkeypatch.setattr(
        sys,
        "argv",
        ["generate_price_direction_predictions.py", "--model-path", str(model_path), "--dry-run"],
    )

    exit_code = script.main()

    assert exit_code == 0
    assert not save_called


def test_cli_writes_when_not_dry_run(monkeypatch, tmp_path):
    """測試非 dry-run 模式會呼叫 Supabase upsert 函式。"""
    model_path = tmp_path / "model.joblib"
    model_path.write_bytes(b"fake")
    written_rows = []

    def fake_save(payload_df):
        written_rows.append(len(payload_df))
        return len(payload_df)

    monkeypatch.setattr(script, "load_historical_prices_for_ml", lambda: make_history())
    monkeypatch.setattr(script, "load_model_payload", lambda path: make_model_payload())
    monkeypatch.setattr(script, "read_pair_risk", lambda path: None)
    monkeypatch.setattr(script, "save_price_direction_predictions_to_supabase", fake_save)
    monkeypatch.setattr(
        sys,
        "argv",
        ["generate_price_direction_predictions.py", "--model-path", str(model_path)],
    )

    exit_code = script.main()

    assert exit_code == 0
    assert written_rows == [1]


def test_cli_fails_when_history_empty(monkeypatch, tmp_path):
    """測試歷史資料為空時會失敗，避免寫入空 payload。"""
    model_path = tmp_path / "model.joblib"
    model_path.write_bytes(b"fake")

    monkeypatch.setattr(script, "load_historical_prices_for_ml", lambda: pd.DataFrame())
    monkeypatch.setattr(
        sys,
        "argv",
        ["generate_price_direction_predictions.py", "--model-path", str(model_path), "--dry-run"],
    )

    exit_code = script.main()

    assert exit_code == 1
