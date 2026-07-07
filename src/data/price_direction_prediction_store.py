# -*- coding: utf-8 -*-
"""
模組名稱: src.data.price_direction_prediction_store
功能說明: 建立並 upsert 價格方向 ML 預測結果至 Supabase PostgreSQL 的 `price_direction_predictions` 資料表。

【相關元件 (Related Components)】
- 依賴: sqlalchemy
- 依賴: pandas
- 依賴: src.data.prediction_store._load_database_url
- 依賴: src.ml.price_direction_predictor.validate_price_direction_payload
- 被依賴: scripts.generate_price_direction_predictions
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text

from src.data.prediction_store import _load_database_url
from src.ml.price_direction_predictor import BASE_PAYLOAD_COLUMNS, validate_price_direction_payload


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS price_direction_predictions (
    upsert_key TEXT PRIMARY KEY,
    market_id TEXT NOT NULL,
    market_name TEXT,
    crop_id TEXT NOT NULL,
    crop_name TEXT,
    base_date DATE NOT NULL,
    global_latest_trade_date DATE NOT NULL,
    data_staleness_days INTEGER NOT NULL CHECK (data_staleness_days BETWEEN 0 AND 7),
    prediction_target TEXT NOT NULL,
    pred_label_direction INTEGER NOT NULL CHECK (pred_label_direction IN (-1, 0, 1)),
    pred_label_name TEXT NOT NULL CHECK (pred_label_name IN ('跌', '持平', '漲')),
    prob_down DOUBLE PRECISION NOT NULL CHECK (prob_down >= 0 AND prob_down <= 1),
    prob_flat DOUBLE PRECISION NOT NULL CHECK (prob_flat >= 0 AND prob_flat <= 1),
    prob_up DOUBLE PRECISION NOT NULL CHECK (prob_up >= 0 AND prob_up <= 1),
    pred_confidence DOUBLE PRECISION NOT NULL CHECK (pred_confidence >= 0 AND pred_confidence <= 1),
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('低', '中', '高')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('normal', 'medium', 'high')),
    risk_note TEXT,
    display_message TEXT NOT NULL,
    model_type TEXT NOT NULL,
    payload_version TEXT NOT NULL,
    created_by_stage TEXT NOT NULL,
    prepared_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_market_crop
    ON price_direction_predictions (market_id, crop_id);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_base_date
    ON price_direction_predictions (base_date DESC);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_direction
    ON price_direction_predictions (pred_label_direction);
"""


UPSERT_SQL = """
INSERT INTO price_direction_predictions (
    upsert_key,
    market_id,
    market_name,
    crop_id,
    crop_name,
    base_date,
    global_latest_trade_date,
    data_staleness_days,
    prediction_target,
    pred_label_direction,
    pred_label_name,
    prob_down,
    prob_flat,
    prob_up,
    pred_confidence,
    confidence_level,
    risk_level,
    risk_note,
    display_message,
    model_type,
    payload_version,
    created_by_stage,
    prepared_at
)
VALUES (
    :upsert_key,
    :market_id,
    :market_name,
    :crop_id,
    :crop_name,
    :base_date,
    :global_latest_trade_date,
    :data_staleness_days,
    :prediction_target,
    :pred_label_direction,
    :pred_label_name,
    :prob_down,
    :prob_flat,
    :prob_up,
    :pred_confidence,
    :confidence_level,
    :risk_level,
    :risk_note,
    :display_message,
    :model_type,
    :payload_version,
    :created_by_stage,
    :prepared_at
)
ON CONFLICT (upsert_key)
DO UPDATE SET
    market_id = EXCLUDED.market_id,
    market_name = EXCLUDED.market_name,
    crop_id = EXCLUDED.crop_id,
    crop_name = EXCLUDED.crop_name,
    base_date = EXCLUDED.base_date,
    global_latest_trade_date = EXCLUDED.global_latest_trade_date,
    data_staleness_days = EXCLUDED.data_staleness_days,
    prediction_target = EXCLUDED.prediction_target,
    pred_label_direction = EXCLUDED.pred_label_direction,
    pred_label_name = EXCLUDED.pred_label_name,
    prob_down = EXCLUDED.prob_down,
    prob_flat = EXCLUDED.prob_flat,
    prob_up = EXCLUDED.prob_up,
    pred_confidence = EXCLUDED.pred_confidence,
    confidence_level = EXCLUDED.confidence_level,
    risk_level = EXCLUDED.risk_level,
    risk_note = EXCLUDED.risk_note,
    display_message = EXCLUDED.display_message,
    model_type = EXCLUDED.model_type,
    payload_version = EXCLUDED.payload_version,
    created_by_stage = EXCLUDED.created_by_stage,
    prepared_at = EXCLUDED.prepared_at,
    updated_at = NOW();
"""


def _clean_scalar(value: Any) -> Any:
    """
    將 pandas/numpy scalar 轉為 SQLAlchemy 可安全綁定的 Python 原生值。
    """
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def _records_from_payload(payload_df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    將 payload DataFrame 轉為 upsert records。
    """
    records = []
    for row in payload_df[BASE_PAYLOAD_COLUMNS].to_dict(orient="records"):
        records.append({key: _clean_scalar(value) for key, value in row.items()})
    return records


def save_price_direction_predictions_to_supabase(payload_df: pd.DataFrame) -> int:
    """
    將價格方向預測 payload 寫入 Supabase `price_direction_predictions`。

    回傳:
        int: 寫入或更新的筆數。
    """
    validate_price_direction_payload(payload_df)
    database_url = _load_database_url()
    if not database_url:
        raise RuntimeError("未偵測到 DATABASE_URL，無法寫入 price_direction_predictions。")

    records = _records_from_payload(payload_df)
    engine = create_engine(database_url, pool_pre_ping=True)

    with engine.begin() as conn:
        for statement in CREATE_TABLE_SQL.split(";"):
            sql = statement.strip()
            if sql:
                conn.execute(text(sql))
        conn.execute(text(UPSERT_SQL), records)

    print(f"成功 Upsert 寫入 {len(records)} 筆價格方向預測至 price_direction_predictions。", flush=True)
    return len(records)
