"""
模組名稱: src.ml.direction_predictor
功能說明: 載入已訓練的 LightGBM v2 模型，對指定品項 × 市場的最新歷史資料進行漲跌方向預測。

輸出：
  - direction: "up" / "down" / "flat"
  - prob_up / prob_down / prob_flat: 各類別機率（0~1）
  - confidence: 最高機率值，代表模型信心度
  - trade_date: 預測所依據的最新交易日
"""
from __future__ import annotations

from pathlib import Path
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

_MODEL_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "lgb_direction_model.txt"
_LE_PATH    = Path(__file__).resolve().parents[2] / "data" / "processed" / "label_encoder.pkl"

FEATURE_COLS = [
    "lag_1", "lag_7", "lag_14",
    "ret_lag_1", "ret_lag_7",
    "rolling_mean_7", "rolling_std_7",
    "rolling_mean_14", "rolling_std_14",
    "rolling_mean_30", "rolling_std_30",
    "weekday", "month", "is_weekend",
    "solar_term_flag", "holiday_flag",
]


@lru_cache(maxsize=1)
def _load_model():
    """載入模型與 LabelEncoder（只載入一次，快取於記憶體）。"""
    try:
        import lightgbm as lgb
        model = lgb.Booster(model_file=str(_MODEL_PATH))
        le    = joblib.load(_LE_PATH)
        return model, le
    except Exception:
        return None, None


def _build_features(history: pd.Series) -> dict | None:
    """
    從歷史 avg_price 序列計算 16 個特徵。
    history：依日期升序排列的 avg_price Series，index 為 trade_date。
    最少需要 30 筆資料（rolling_std_30 需要）。
    """
    s = history.dropna()
    if len(s) < 30:
        return None

    latest_date = s.index[-1]
    today = pd.Timestamp(latest_date)

    lag_1  = float(s.iloc[-2])  if len(s) >= 2  else np.nan
    lag_7  = float(s.iloc[-8])  if len(s) >= 8  else np.nan
    lag_14 = float(s.iloc[-15]) if len(s) >= 15 else np.nan

    ret_lag_1 = (float(s.iloc[-1]) - lag_1) / lag_1 * 100 if lag_1 else np.nan
    ret_lag_7 = (float(s.iloc[-1]) - lag_7) / lag_7 * 100 if lag_7 else np.nan

    return {
        "lag_1":            lag_1,
        "lag_7":            lag_7,
        "lag_14":           lag_14,
        "ret_lag_1":        ret_lag_1,
        "ret_lag_7":        ret_lag_7,
        "rolling_mean_7":   float(s.iloc[-7:].mean()),
        "rolling_std_7":    float(s.iloc[-7:].std(ddof=0)),
        "rolling_mean_14":  float(s.iloc[-14:].mean()),
        "rolling_std_14":   float(s.iloc[-14:].std(ddof=0)),
        "rolling_mean_30":  float(s.iloc[-30:].mean()),
        "rolling_std_30":   float(s.iloc[-30:].std(ddof=0)),
        "weekday":          today.weekday(),
        "month":            today.month,
        "is_weekend":       int(today.weekday() >= 5),
        "solar_term_flag":  0,   # 簡化：即時預測不查節氣
        "holiday_flag":     0,
    }


def predict_direction(
    history_df: pd.DataFrame,
    crop_name: str = "",
    market_name: str = "",
) -> dict:
    """
    對單一品項 × 市場進行漲跌方向預測。

    參數:
        history_df: 歷史行情 DataFrame，須含 trans_date、avg_price 欄位。
        crop_name:  品項名稱（僅用於回傳結果標示）。
        market_name: 市場名稱（同上）。

    回傳:
        dict，包含 direction、prob_up、prob_down、prob_flat、confidence、trade_date。
    """
    model, le = _load_model()

    _no_model = {
        "crop_name":   crop_name,
        "market_name": market_name,
        "direction":   None,
        "prob_up":     None,
        "prob_down":   None,
        "prob_flat":   None,
        "confidence":  None,
        "trade_date":  None,
        "note":        "模型尚未載入",
    }

    if model is None:
        return _no_model

    if history_df is None or history_df.empty:
        return {**_no_model, "note": "歷史資料不足"}

    df = history_df.copy()
    df["trans_date"] = pd.to_datetime(df["trans_date"])
    df = df.sort_values("trans_date").dropna(subset=["avg_price"])
    df = df[df["avg_price"] > 0]

    series = df.set_index("trans_date")["avg_price"]
    feats  = _build_features(series)

    if feats is None:
        return {**_no_model, "note": f"歷史資料不足 30 筆（現有 {len(series)} 筆）"}

    X = pd.DataFrame([feats])[FEATURE_COLS]
    proba = model.predict(X)[0]          # shape: (3,)
    pred_idx   = int(proba.argmax())
    direction  = le.inverse_transform([pred_idx])[0]

    label_map = dict(zip(le.classes_, range(len(le.classes_))))  # down=0, flat=1, up=2
    return {
        "crop_name":   crop_name,
        "market_name": market_name,
        "trade_date":  str(series.index[-1].date()),
        "direction":   direction,
        "prob_down":   round(float(proba[label_map["down"]]), 3),
        "prob_flat":   round(float(proba[label_map["flat"]]), 3),
        "prob_up":     round(float(proba[label_map["up"]]),   3),
        "confidence":  round(float(proba.max()), 3),
        "note":        "",
    }
