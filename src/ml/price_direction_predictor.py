# -*- coding: utf-8 -*-
"""
模組名稱: src.ml.price_direction_predictor
功能說明: 將歷史農產品行情轉為價格方向模型所需特徵，載入已訓練模型並產生 Supabase 可寫入的方向預測 payload。

【相關元件 (Related Components)】
- 依賴: pandas
- 依賴: numpy
- 被依賴: scripts.generate_price_direction_predictions
- 被依賴: tests.test_price_direction_predictor
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


LABEL_NAME_MAP = {-1: "跌", 0: "持平", 1: "漲"}
ENCODED_TO_LABEL = {0: -1, 1: 0, 2: 1}
PREDICTION_TARGET = "next_trade_day"
MAX_FRONTEND_STALENESS_DAYS = 7
PAYLOAD_VERSION = "v1"
CREATED_BY_STAGE = "github_actions_price_direction_prediction"

PRICE_LAGS = [1, 3, 7, 14]
VOLUME_LAGS = [1, 3, 7, 14]
ROLLING_WINDOWS = [7, 14]

BASE_PAYLOAD_COLUMNS = [
    "upsert_key",
    "market_id",
    "market_name",
    "crop_id",
    "crop_name",
    "base_date",
    "global_latest_trade_date",
    "data_staleness_days",
    "prediction_target",
    "pred_label_direction",
    "pred_label_name",
    "prob_down",
    "prob_flat",
    "prob_up",
    "pred_confidence",
    "confidence_level",
    "risk_level",
    "risk_note",
    "display_message",
    "model_type",
    "payload_version",
    "created_by_stage",
    "prepared_at",
]


def load_model_payload(model_path: str | Path) -> dict[str, Any]:
    """
    載入 joblib 格式的最終模型 payload。

    注意：joblib 與 lightgbm 只在真正載入模型時才匯入，讓單元測試可以在不載入模型檔的情況下測試特徵與 payload 邏輯。
    """
    import joblib

    payload = joblib.load(model_path)
    required_keys = {"model", "model_type", "model_feature_columns", "categorical_feature_columns", "category_maps"}
    missing_keys = sorted(required_keys - set(payload))
    if missing_keys:
        raise ValueError(f"模型 payload 缺少必要欄位：{missing_keys}")
    return payload


def normalize_price_history(history_df: pd.DataFrame) -> pd.DataFrame:
    """
    將 SmartBuy 既有行情欄位正規化為模型訓練時使用的欄位命名。

    SmartBuy repo 目前使用 `trans_date/crop_code/market_code`，而價格方向模型使用
    `trade_date/crop_id/market_id`。此函式會保留名稱欄位並統一代碼欄位為字串。
    """
    if history_df is None or history_df.empty:
        return pd.DataFrame(
            columns=[
                "trade_date",
                "market_id",
                "market_name",
                "crop_id",
                "crop_name",
                "avg_price",
                "volume",
            ]
        )

    df = history_df.copy()
    rename_map = {
        "trans_date": "trade_date",
        "market_code": "market_id",
        "crop_code": "crop_id",
    }
    for source_col, target_col in rename_map.items():
        if target_col not in df.columns and source_col in df.columns:
            df = df.rename(columns={source_col: target_col})

    required_columns = {
        "trade_date",
        "market_id",
        "market_name",
        "crop_id",
        "crop_name",
        "avg_price",
        "volume",
    }
    missing_columns = sorted(required_columns - set(df.columns))
    if missing_columns:
        raise ValueError(f"歷史行情資料缺少價格方向推論必要欄位：{missing_columns}")

    df = df.loc[:, ["trade_date", "market_id", "market_name", "crop_id", "crop_name", "avg_price", "volume"]].copy()
    df["trade_date"] = pd.to_datetime(df["trade_date"], errors="coerce")
    df = df.dropna(subset=["trade_date", "market_id", "crop_id"])
    df["market_id"] = df["market_id"].astype("string")
    df["crop_id"] = df["crop_id"].astype("string")
    df["market_name"] = df["market_name"].astype("string")
    df["crop_name"] = df["crop_name"].astype("string")
    df["avg_price"] = pd.to_numeric(df["avg_price"], errors="coerce").astype("float64")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").astype("float64")
    return df.sort_values(["market_id", "crop_id", "trade_date"]).reset_index(drop=True)


def build_time_series_features(history_df: pd.DataFrame) -> pd.DataFrame:
    """
    依第 08 階段 Notebook 的規則建立 lag、return、rolling 與日曆特徵。
    """
    feature_df = normalize_price_history(history_df)
    if feature_df.empty:
        return feature_df

    grouped = feature_df.groupby(["market_id", "crop_id"], group_keys=False, sort=False)

    for lag in PRICE_LAGS:
        feature_df[f"price_lag_{lag}"] = grouped["avg_price"].shift(lag)
        feature_df[f"price_return_{lag}"] = feature_df["avg_price"] / feature_df[f"price_lag_{lag}"] - 1

    for lag in VOLUME_LAGS:
        feature_df[f"volume_lag_{lag}"] = grouped["volume"].shift(lag)

    for lag in [1, 7]:
        feature_df[f"volume_change_{lag}"] = feature_df["volume"] / feature_df[f"volume_lag_{lag}"] - 1

    for window in ROLLING_WINDOWS:
        feature_df[f"price_ma_{window}"] = grouped["avg_price"].transform(
            lambda series: series.rolling(window=window, min_periods=window).mean()
        )
        feature_df[f"volume_ma_{window}"] = grouped["volume"].transform(
            lambda series: series.rolling(window=window, min_periods=window).mean()
        )
        feature_df[f"price_std_{window}"] = grouped["avg_price"].transform(
            lambda series: series.rolling(window=window, min_periods=window).std(ddof=0)
        )

    feature_df["price_vs_ma_7"] = np.where(
        feature_df["price_ma_7"].gt(0),
        feature_df["avg_price"] / feature_df["price_ma_7"] - 1,
        np.nan,
    )
    feature_df["volume_vs_ma_7"] = np.where(
        feature_df["volume_ma_7"].gt(0),
        feature_df["volume"] / feature_df["volume_ma_7"] - 1,
        np.nan,
    )
    feature_df["day_of_week"] = feature_df["trade_date"].dt.dayofweek.astype("int16")
    feature_df["month"] = feature_df["trade_date"].dt.month.astype("int16")
    feature_df["month_sin"] = np.sin(2 * np.pi * feature_df["month"] / 12)
    feature_df["month_cos"] = np.cos(2 * np.pi * feature_df["month"] / 12)

    return feature_df.replace([np.inf, -np.inf], np.nan)


def select_latest_inference_features(feature_df: pd.DataFrame) -> pd.DataFrame:
    """
    取每個市場與作物組合最新一筆交易資料作為每日推論候選列。
    """
    if feature_df.empty:
        return feature_df.copy()

    latest_index = feature_df.groupby(["market_id", "crop_id"], sort=False)["trade_date"].idxmax()
    inference_df = feature_df.loc[latest_index].copy().reset_index(drop=True)
    global_latest_trade_date = feature_df["trade_date"].max()
    inference_df["global_latest_trade_date"] = global_latest_trade_date
    inference_df["data_staleness_days"] = (global_latest_trade_date - inference_df["trade_date"]).dt.days
    return inference_df


def mark_inference_eligibility(inference_df: pd.DataFrame, model_payload: dict[str, Any]) -> pd.DataFrame:
    """
    檢查最新候選列是否可安全餵入模型。

    條件包含市場與作物代碼曾在訓練集中出現，且所有模型數值特徵不缺值。
    """
    if inference_df.empty:
        return inference_df.copy()

    result_df = inference_df.copy()
    model_feature_columns = list(model_payload["model_feature_columns"])
    categorical_feature_columns = list(model_payload["categorical_feature_columns"])
    category_maps = model_payload["category_maps"]

    missing_features = sorted(set(model_feature_columns) - set(result_df.columns))
    if missing_features:
        raise ValueError(f"推論特徵缺少模型必要欄位：{missing_features}")

    known_market_ids = set(pd.Index(category_maps["market_id"]).astype(str))
    known_crop_ids = set(pd.Index(category_maps["crop_id"]).astype(str))
    numeric_model_features = [col for col in model_feature_columns if col not in categorical_feature_columns]

    result_df["known_market_id"] = result_df["market_id"].astype(str).isin(known_market_ids)
    result_df["known_crop_id"] = result_df["crop_id"].astype(str).isin(known_crop_ids)
    result_df["is_feature_complete"] = result_df[numeric_model_features].notna().all(axis=1)
    result_df["is_inference_eligible"] = (
        result_df["known_market_id"] & result_df["known_crop_id"] & result_df["is_feature_complete"]
    )

    def build_reason(row: pd.Series) -> str:
        reasons: list[str] = []
        if not row["known_market_id"]:
            reasons.append("market_id_not_seen_in_training")
        if not row["known_crop_id"]:
            reasons.append("crop_id_not_seen_in_training")
        if not row["is_feature_complete"]:
            reasons.append("required_feature_missing")
        return "eligible" if not reasons else "|".join(reasons)

    result_df["inference_status"] = result_df.apply(build_reason, axis=1)
    return result_df


def build_lightgbm_matrix(source_df: pd.DataFrame, model_payload: dict[str, Any]) -> pd.DataFrame:
    """
    依模型 payload 建立 LightGBM predict_proba 所需矩陣，特別保留訓練時的類別順序。
    """
    feature_columns = list(model_payload["model_feature_columns"])
    categorical_feature_columns = list(model_payload["categorical_feature_columns"])
    category_maps = model_payload["category_maps"]

    matrix_df = source_df.loc[:, feature_columns].copy()
    for col in feature_columns:
        if col in categorical_feature_columns:
            categories = pd.Index(category_maps[col]).astype(str)
            matrix_df[col] = pd.Categorical(matrix_df[col].astype("string"), categories=categories)
        else:
            matrix_df[col] = pd.to_numeric(matrix_df[col], errors="coerce")
            matrix_df[col] = matrix_df[col].replace([np.inf, -np.inf], np.nan)
    return matrix_df


def confidence_level(confidence: float) -> str:
    """
    將模型最高類別機率轉為前端可顯示的信心等級。
    """
    if confidence >= 0.8:
        return "高"
    if confidence >= 0.6:
        return "中"
    return "低"


def normalize_pair_risk(pair_risk_df: pd.DataFrame | None) -> pd.DataFrame:
    """
    將第 07 階段 pair error 報告轉為推論風險規則可使用的欄位。
    """
    columns = [
        "market_id",
        "crop_id",
        "validation_pair_samples",
        "validation_pair_error_rate",
        "validation_pair_direction_reversal_rate",
    ]
    if pair_risk_df is None or pair_risk_df.empty:
        return pd.DataFrame(columns=columns)

    risk_df = pair_risk_df.copy()
    rename_map = {
        "n_samples": "validation_pair_samples",
        "error_rate": "validation_pair_error_rate",
        "direction_reversal_rate": "validation_pair_direction_reversal_rate",
    }
    risk_df = risk_df.rename(columns={k: v for k, v in rename_map.items() if k in risk_df.columns})
    for col in columns:
        if col not in risk_df.columns:
            risk_df[col] = np.nan
    risk_df["market_id"] = risk_df["market_id"].astype("string")
    risk_df["crop_id"] = risk_df["crop_id"].astype("string")
    return risk_df[columns].copy()


def assign_risk_level(row: pd.Series, max_staleness_days: int = MAX_FRONTEND_STALENESS_DAYS) -> str:
    """
    依資料新鮮度、模型信心與歷史方向逆轉率給出風險等級。
    """
    pair_reversal = row.get("validation_pair_direction_reversal_rate")
    if row["data_staleness_days"] > max_staleness_days:
        return "high"
    if row["pred_confidence"] < 0.6:
        return "high"
    if pd.notna(pair_reversal) and pair_reversal > 0.35:
        return "high"
    if pd.notna(pair_reversal) and pair_reversal > 0.25:
        return "medium"
    return "normal"


def build_risk_note(row: pd.Series, max_staleness_days: int = MAX_FRONTEND_STALENESS_DAYS) -> str:
    """
    將風險等級轉為前端白話提醒。
    """
    if row["risk_level"] == "high" and row["data_staleness_days"] > max_staleness_days:
        return "資料不是近期交易日，不建議在前端主畫面直接呈現"
    if row["risk_level"] == "high" and row["pred_confidence"] < 0.6:
        return "模型信心偏低，前端應以提醒方式呈現"
    if row["risk_level"] == "high":
        return "該組合歷史方向性逆轉錯誤偏高，需謹慎解讀"
    if row["risk_level"] == "medium":
        return "該組合歷史方向性逆轉錯誤略高，建議搭配價格趨勢查看"
    return "一般風險"


def predict_price_directions(
    history_df: pd.DataFrame,
    model_payload: dict[str, Any],
    pair_risk_df: pd.DataFrame | None = None,
    max_staleness_days: int = MAX_FRONTEND_STALENESS_DAYS,
) -> pd.DataFrame:
    """
    從歷史行情資料產生每個市場作物組合的最新價格方向預測。
    """
    feature_df = build_time_series_features(history_df)
    inference_df = select_latest_inference_features(feature_df)
    eligible_df = mark_inference_eligibility(inference_df, model_payload)
    eligible_df = eligible_df.loc[eligible_df["is_inference_eligible"]].copy()
    if eligible_df.empty:
        return pd.DataFrame(columns=BASE_PAYLOAD_COLUMNS)

    matrix = build_lightgbm_matrix(eligible_df, model_payload)
    pred_proba = np.asarray(model_payload["model"].predict_proba(matrix), dtype="float64")
    if pred_proba.ndim != 2 or pred_proba.shape[1] != 3:
        raise ValueError(f"模型 predict_proba 應回傳三類機率，目前 shape={pred_proba.shape}")

    pred_encoded = pred_proba.argmax(axis=1)
    pred_label = pd.Series(pred_encoded).map(ENCODED_TO_LABEL).astype(int).to_numpy()

    prediction_df = eligible_df[
        [
            "trade_date",
            "global_latest_trade_date",
            "data_staleness_days",
            "market_id",
            "market_name",
            "crop_id",
            "crop_name",
            "avg_price",
            "volume",
        ]
    ].copy()
    prediction_df = prediction_df.rename(columns={"trade_date": "base_date"})
    prediction_df["prediction_target"] = PREDICTION_TARGET
    prediction_df["model_type"] = model_payload["model_type"]
    prediction_df["pred_label_direction"] = pred_label
    prediction_df["pred_label_name"] = prediction_df["pred_label_direction"].map(LABEL_NAME_MAP)
    prediction_df["prob_down"] = pred_proba[:, 0]
    prediction_df["prob_flat"] = pred_proba[:, 1]
    prediction_df["prob_up"] = pred_proba[:, 2]
    prediction_df["pred_confidence"] = pred_proba.max(axis=1)
    prediction_df["confidence_level"] = prediction_df["pred_confidence"].map(confidence_level)
    prediction_df["display_message"] = (
        prediction_df["market_name"].astype(str)
        + " / "
        + prediction_df["crop_name"].astype(str)
        + "：下一個交易日預測"
        + prediction_df["pred_label_name"].astype(str)
        + "，信心 "
        + prediction_df["confidence_level"].astype(str)
    )

    risk_df = normalize_pair_risk(pair_risk_df)
    for key_col in ["market_id", "crop_id"]:
        prediction_df[key_col] = prediction_df[key_col].astype("string")
    prediction_df = prediction_df.merge(risk_df, on=["market_id", "crop_id"], how="left")
    prediction_df["risk_level"] = prediction_df.apply(assign_risk_level, axis=1, max_staleness_days=max_staleness_days)
    prediction_df["risk_note"] = prediction_df.apply(build_risk_note, axis=1, max_staleness_days=max_staleness_days)

    publishable_df = prediction_df.loc[prediction_df["data_staleness_days"] <= max_staleness_days].copy()
    return build_supabase_payload(publishable_df)


def build_supabase_payload(prediction_df: pd.DataFrame, prepared_at: str | None = None) -> pd.DataFrame:
    """
    將推論結果整理成 `price_direction_predictions` 表可 upsert 的欄位。
    """
    if prediction_df.empty:
        return pd.DataFrame(columns=BASE_PAYLOAD_COLUMNS)

    payload_df = prediction_df.copy()
    prepared_at_value = prepared_at or datetime.now(timezone.utc).isoformat()
    for date_col in ["base_date", "global_latest_trade_date"]:
        payload_df[date_col] = pd.to_datetime(payload_df[date_col]).dt.strftime("%Y-%m-%d")

    payload_df["upsert_key"] = (
        payload_df["market_id"].astype(str)
        + "__"
        + payload_df["crop_id"].astype(str)
        + "__"
        + payload_df["base_date"].astype(str)
    )
    payload_df["payload_version"] = PAYLOAD_VERSION
    payload_df["created_by_stage"] = CREATED_BY_STAGE
    payload_df["prepared_at"] = prepared_at_value

    for col in ["prob_down", "prob_flat", "prob_up", "pred_confidence"]:
        payload_df[col] = pd.to_numeric(payload_df[col], errors="coerce").round(10)
    payload_df["data_staleness_days"] = pd.to_numeric(payload_df["data_staleness_days"], errors="raise").astype(int)
    payload_df["pred_label_direction"] = pd.to_numeric(payload_df["pred_label_direction"], errors="raise").astype(int)

    payload_df = payload_df[BASE_PAYLOAD_COLUMNS].copy()
    validate_price_direction_payload(payload_df)
    return payload_df.sort_values(["market_id", "crop_id", "base_date"]).reset_index(drop=True)


def validate_price_direction_payload(payload_df: pd.DataFrame) -> None:
    """
    驗證 Supabase payload 欄位、值域與主鍵唯一性。
    """
    if payload_df.empty:
        raise ValueError("價格方向預測 payload 為空，無法寫入 Supabase")

    missing_columns = sorted(set(BASE_PAYLOAD_COLUMNS) - set(payload_df.columns))
    if missing_columns:
        raise ValueError(f"價格方向預測 payload 缺少必要欄位：{missing_columns}")

    required_not_null = [col for col in BASE_PAYLOAD_COLUMNS if col != "risk_note"]
    null_counts = payload_df[required_not_null].isna().sum()
    bad_nulls = null_counts.loc[null_counts > 0].to_dict()
    if bad_nulls:
        raise ValueError(f"價格方向預測 payload 必要欄位不可為空：{bad_nulls}")

    if not payload_df["upsert_key"].is_unique:
        duplicates = payload_df.loc[payload_df["upsert_key"].duplicated(), "upsert_key"].head(5).tolist()
        raise ValueError(f"價格方向預測 upsert_key 不可重複，範例：{duplicates}")

    if not payload_df["pred_label_direction"].isin([-1, 0, 1]).all():
        raise ValueError("pred_label_direction 只能是 -1、0、1")
    if not payload_df["pred_label_name"].isin(["跌", "持平", "漲"]).all():
        raise ValueError("pred_label_name 只能是跌、持平、漲")
    if not payload_df["confidence_level"].isin(["低", "中", "高"]).all():
        raise ValueError("confidence_level 只能是低、中、高")
    if not payload_df["risk_level"].isin(["normal", "medium", "high"]).all():
        raise ValueError("risk_level 只能是 normal、medium、high")
    if not payload_df["data_staleness_days"].between(0, MAX_FRONTEND_STALENESS_DAYS).all():
        raise ValueError(f"data_staleness_days 必須介於 0 到 {MAX_FRONTEND_STALENESS_DAYS}")

    probability_cols = ["prob_down", "prob_flat", "prob_up"]
    probability_df = payload_df[probability_cols].apply(pd.to_numeric, errors="coerce")
    if not probability_df.ge(0).all().all() or not probability_df.le(1).all().all():
        raise ValueError("三個類別機率都必須介於 0 與 1")

    probability_sum = probability_df.sum(axis=1)
    if not np.allclose(probability_sum, 1.0, atol=1e-6):
        raise ValueError("三個類別機率加總應接近 1")

    confidence = pd.to_numeric(payload_df["pred_confidence"], errors="coerce")
    if not np.allclose(confidence, probability_df.max(axis=1), atol=1e-6):
        raise ValueError("pred_confidence 應等於三個類別機率的最大值")
