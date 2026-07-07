# -*- coding: utf-8 -*-
"""
腳本名稱: scripts.generate_price_direction_predictions
功能說明: 每日價格方向 ML 預測任務，讀取 Parquet 歷史資料、載入已訓練 LightGBM 模型，並 UPSERT 寫入 Supabase `price_direction_predictions`。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_historical_prices_for_ml
- 依賴: src.ml.price_direction_predictor
- 依賴: src.data.price_direction_prediction_store
- 被依賴: .github/workflows/daily_agri_price_update.yml
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data.data_loader import load_historical_prices_for_ml  # noqa: E402
from src.data.price_direction_prediction_store import (  # noqa: E402
    save_price_direction_predictions_to_supabase,
)
from src.ml.price_direction_predictor import (  # noqa: E402
    MAX_FRONTEND_STALENESS_DAYS,
    load_model_payload,
    predict_price_directions,
    validate_price_direction_payload,
)


DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "07_lightgbm_selected_final.joblib"
DEFAULT_PAIR_RISK_PATH = PROJECT_ROOT / "reports" / "07_selected_model_error_by_pair.csv"


def read_pair_risk(path: Path) -> pd.DataFrame | None:
    """
    讀取第 07 階段 pair error 報告；若檔案不存在則安全跳過。
    """
    if not path.exists():
        print(f"未找到 pair risk 報告，將僅依資料新鮮度與模型信心判斷風險：{path}", flush=True)
        return None
    return pd.read_csv(path, dtype={"market_id": str, "crop_id": str})


def build_parser() -> argparse.ArgumentParser:
    """
    建立 CLI 參數。
    """
    parser = argparse.ArgumentParser(description="產生每日價格方向 ML 預測並寫入 Supabase")
    parser.add_argument(
        "--model-path",
        type=Path,
        default=DEFAULT_MODEL_PATH,
        help="已訓練 joblib 模型 payload 路徑",
    )
    parser.add_argument(
        "--pair-risk-path",
        type=Path,
        default=DEFAULT_PAIR_RISK_PATH,
        help="可選，第 07 階段市場作物組合錯誤風險報告",
    )
    parser.add_argument(
        "--max-staleness-days",
        type=int,
        default=MAX_FRONTEND_STALENESS_DAYS,
        help="只寫入距離全域最新交易日不超過此天數的預測",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        help="可選，將本次 payload 另存為 CSV 供人工檢查",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只產生並驗證 payload，不寫入 Supabase",
    )
    return parser


def main() -> int:
    """
    CLI 入口。
    """
    args = build_parser().parse_args()

    if args.max_staleness_days < 0:
        print("[Error] --max-staleness-days 不可小於 0。", file=sys.stderr)
        return 1
    if not args.model_path.exists():
        print(f"[Error] 找不到價格方向模型檔：{args.model_path}", file=sys.stderr)
        return 1

    print("開始載入 Parquet 歷史行情資料...", flush=True)
    history_df = load_historical_prices_for_ml()
    if history_df.empty:
        print("[Error] 歷史 Parquet 資料為空，無法產生價格方向預測。", file=sys.stderr)
        print("請確認每日行情更新流程已完成 R2 下載與 Parquet 合併。", file=sys.stderr)
        return 1
    print(f"歷史行情載入完成，資料筆數：{len(history_df)}", flush=True)

    print(f"開始載入價格方向模型：{args.model_path}", flush=True)
    model_payload = load_model_payload(args.model_path)
    pair_risk_df = read_pair_risk(args.pair_risk_path)

    print("開始產生價格方向預測 payload...", flush=True)
    try:
        payload_df = predict_price_directions(
            history_df=history_df,
            model_payload=model_payload,
            pair_risk_df=pair_risk_df,
            max_staleness_days=args.max_staleness_days,
        )
        validate_price_direction_payload(payload_df)
    except Exception as exc:
        print(f"[Error] 價格方向預測 payload 產生或驗證失敗：{exc}", file=sys.stderr)
        return 1

    print(f"價格方向預測完成，可寫入筆數：{len(payload_df)}", flush=True)
    label_summary = (
        payload_df.groupby(["pred_label_direction", "pred_label_name"], dropna=False)
        .size()
        .reset_index(name="count")
        .sort_values("pred_label_direction")
    )
    print(label_summary.to_string(index=False), flush=True)

    if args.output_csv:
        args.output_csv.parent.mkdir(parents=True, exist_ok=True)
        payload_df.to_csv(args.output_csv, index=False, encoding="utf-8-sig")
        print(f"已輸出 payload CSV：{args.output_csv}", flush=True)

    if args.dry_run:
        print("[Dry Run] 已完成 payload 產生與驗證，未寫入 Supabase。", flush=True)
        return 0

    try:
        write_count = save_price_direction_predictions_to_supabase(payload_df)
    except Exception as exc:
        print(f"[Error] 寫入 Supabase price_direction_predictions 失敗：{exc}", file=sys.stderr)
        return 1

    print(f"每日價格方向 ML 預測流程完成，寫入/更新 {write_count} 筆。", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
