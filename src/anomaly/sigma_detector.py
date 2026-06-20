"""
模組名稱: src.anomaly.sigma_detector
功能說明: 使用統計方法（Sigma）偵測價格異常波動的邏輯。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class SigmaResult:
    status: str
    today_price: float
    mean_price: float | None
    std_price: float | None
    upper_limit: float | None
    lower_limit: float | None


def detect_price_status(
    prices: pd.Series | list[float], threshold: float = 2.0, min_history: int = 3
) -> SigmaResult:
    series = pd.Series(prices, dtype="float64").dropna()
    if series.empty:
        raise ValueError("價格資料不可為空")

    today = float(series.iloc[-1])
    history = series.iloc[:-1]
    if len(history) < min_history:
        return SigmaResult("資料不足", today, None, None, None, None)

    mean = float(history.mean())
    std = float(history.std(ddof=0))
    if std == 0:
        status = "偏貴" if today > mean else "便宜" if today < mean else "正常"
        return SigmaResult(status, today, mean, std, mean, mean)

    upper = mean + threshold * std
    lower = mean - threshold * std
    status = "偏貴" if today > upper else "便宜" if today < lower else "正常"
    return SigmaResult(status, today, mean, std, upper, lower)

