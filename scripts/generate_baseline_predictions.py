# -*- coding: utf-8 -*-
"""
腳本名稱: scripts/generate_baseline_predictions
功能說明: [DEPRECATED] 舊版五日數值 Baseline 預測任務，計算未來 5 天價格走勢，並 UPSERT 寫入 Supabase 'prediction_results'。

注意:
    此腳本已退出正式 MVP 範圍，不得加入每日正式排程或前台 fallback。
    正式 MVP 預測流程是 `scripts/generate_price_direction_predictions.py`
    產生下一交易日方向分類並寫入 `price_direction_predictions`。
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data.price_repository import _load_database_url, load_latest_prices, load_price_history
from src.data.data_loader import load_historical_prices_for_ml
from src.data.prediction_store import save_predictions_to_supabase
from src.ml.baseline_predictor import predict_next_5_days


def safe_write_update_log(
    status: str,
    rows_inserted: int = 0,
    error_message: str | None = None,
) -> None:
    """安全寫入執行日誌到 data_update_logs，失敗時僅印出 warning 不中斷主程式。"""
    database_url = _load_database_url()
    if not database_url:
        print("未設定 DATABASE_URL，跳過寫入執行日誌。", flush=True)
        return
        
    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO data_update_logs (
                        job_name,
                        status,
                        rows_inserted,
                        rows_updated,
                        error_message
                    )
                    VALUES (
                        'generate_baseline_predictions',
                        :status,
                        :rows_inserted,
                        0,
                        :error_message
                    );
                    """
                ),
                {
                    "status": status,
                    "rows_inserted": rows_inserted,
                    "error_message": error_message,
                },
            )
        print("成功寫入更新紀錄至 data_update_logs 表。", flush=True)
    except Exception as e:
        print(f"[Warning] 寫入 data_update_logs 失敗，錯誤: {e}", flush=True)


def get_history_and_metadata(crop_code: str, market_code: str) -> tuple[pd.DataFrame, str | None, str | None]:
    """獲取特定作物與市場的歷史資料，並自動解析其對應名稱。"""
    # 1. 優先從 Parquet 歷史數據湖載入 (至少要有 7 筆才算足夠)
    df_hist = load_historical_prices_for_ml(crop_code=crop_code, market_code=market_code)
    if len(df_hist) >= 7:
        crop_name = df_hist.iloc[0].get("crop_name")
        market_name = df_hist.iloc[0].get("market_name")
        return df_hist, crop_name, market_name

    # 2. 若 Parquet 不足，允許 fallback 到 Supabase agri_price_daily 最近 90 天資料
    df_db = load_price_history(crop_code=crop_code, market_code=market_code, days=90)
    if not df_db.empty:
        crop_name = df_db.iloc[0].get("crop_name")
        market_name = df_db.iloc[0].get("market_name")
        return df_db, crop_name, market_name

    # 3. 若資料庫也沒有，但 Parquet 有一些資料 (即便不足 7 筆)，仍傳回以做後續警告處理
    if not df_hist.empty:
        crop_name = df_hist.iloc[0].get("crop_name")
        market_name = df_hist.iloc[0].get("market_name")
        return df_hist, crop_name, market_name

    return pd.DataFrame(), None, None



def main() -> int:
    # 檢查本地歷史 Parquet 目錄狀態並給予 R2 下載指引
    from src.data.r2_sync import LOCAL_PARQUET_DIR
    if not LOCAL_PARQUET_DIR.exists() or not list(LOCAL_PARQUET_DIR.glob("*.parquet")):
        print("【提示】本地未偵測到任何 Parquet 歷史行情檔案。")
        print("如果是獨立執行預測任務，請先執行以下指令自 Cloudflare R2 下載最新歷史資料：")
        print("  python scripts/sync_parquet_r2.py download")
        print("如果是在 GitHub Actions workflow 流程中執行，請確保更新流程已在先前步驟中下載並合併 Parquet。\n")

    parser = argparse.ArgumentParser(description="產生 Baseline 行情預測")
    parser.add_argument("--crop-code", type=str, help="作物代碼")
    parser.add_argument("--market-code", type=str, help="市場代碼")
    parser.add_argument("--top-n", type=int, default=20, help="當代碼未指定時，預設對交易量前 N 的組合進行預測")
    parser.add_argument("--days", type=int, default=5, help="預測天數")
    parser.add_argument("--dry-run", action="store_true", help="乾跑模式，僅輸出結果不寫入 Supabase")
    parser.add_argument("--forecast-start-date", type=str, help="可選，手動指定預測開始日期 (YYYY-MM-DD)")

    args = parser.parse_args()

    start_date = None
    if args.forecast_start_date:
        try:
            start_date = datetime.strptime(args.forecast_start_date, "%Y-%m-%d").date()
        except ValueError as err:
            print(f"錯誤的日期格式：{args.forecast_start_date}，須為 YYYY-MM-DD。錯誤：{err}")
            return 1

    forecast_start = start_date or date.today()
    all_predictions = []
    
    # 判斷執行模式
    if args.crop_code and args.market_code:
        # 單一作物模式
        print(f"單一模式：預測作物 {args.crop_code}，市場 {args.market_code}...")
        df_hist, crop_name, market_name = get_history_and_metadata(args.crop_code, args.market_code)
        
        if df_hist.empty or not crop_name or not market_name:
            print(f"[Error] 查無歷史行情或代碼對照資料：{args.crop_code} - {args.market_code}，跳過。")
        else:
            df_pred = predict_next_5_days(
                history_df=df_hist,
                crop_code=args.crop_code,
                crop_name=crop_name,
                market_code=args.market_code,
                market_name=market_name,
                forecast_start_date=forecast_start,
                days=args.days,
            )
            if not df_pred.empty:
                all_predictions.append(df_pred)
    else:
        # 批次 Top N 模式
        print(f"批次模式：從最新行情中抓取前 {args.top_n} 筆高交易量組合...")
        latest_df = load_latest_prices(limit=300)
        
        if latest_df.empty:
            print("[Error] 載入最新價格資料庫為空，無法執行批次預測。")
            safe_write_update_log(status="failed", error_message="載入最新價格資料庫為空，無法執行批次預測。")
            return 1
            
        # 確保代碼不為空且依交易量排序
        latest_df = latest_df.dropna(subset=["crop_code", "market_code"])
        latest_df = latest_df[
            (latest_df["crop_code"].str.strip() != "") &
            (latest_df["market_code"].str.strip() != "")
        ]
        latest_df = latest_df.sort_values("volume", ascending=False)
        top_combos = latest_df.head(args.top_n)
        
        print(f"共挑選出 {len(top_combos)} 個作物與市場真實組合進行預測...")
        for _, row in top_combos.iterrows():
            c_code = str(row["crop_code"])
            c_name = str(row["crop_name"])
            m_code = str(row["market_code"])
            m_name = str(row["market_name"])
            
            # 載入此組合歷史
            df_hist, _, _ = get_history_and_metadata(c_code, m_code)
            if df_hist.empty:
                print(f"[Warning] 組合 {c_name}({c_code}) - {m_name}({m_code}) 無歷史資料，跳過。")
                continue
                
            df_pred = predict_next_5_days(
                history_df=df_hist,
                crop_code=c_code,
                crop_name=c_name,
                market_code=m_code,
                market_name=m_name,
                forecast_start_date=forecast_start,
                days=args.days,
            )
            if not df_pred.empty:
                all_predictions.append(df_pred)

    if not all_predictions:
        print("[Error] 沒有產生任何預測資料。")
        safe_write_update_log(status="failed", error_message="沒有產生任何預測資料，可能歷史資料均不足。")
        return 0

    final_df = pd.concat(all_predictions, ignore_index=True)
    print(f"\n--- 預測計算完成，共產生 {len(final_df)} 筆預測結果 ---")
    print(final_df.head(10))

    if args.dry_run:
        print("\n[Dry Run] 乾跑模式，不寫入資料庫與執行日誌。")
    else:
        # 寫回 Supabase
        print("\n正在寫入預測結果至 Supabase `prediction_results` 表...", flush=True)
        try:
            write_count = save_predictions_to_supabase(final_df)
            print(f"成功 Upsert 寫入 {write_count} 筆預測記錄至 Supabase。", flush=True)
            
            # 寫入執行日誌
            safe_write_update_log(status="success", rows_inserted=write_count)
        except Exception as e:
            print(f"[Error] 寫入 Supabase 失敗。錯誤: {e}", flush=True)
            safe_write_update_log(status="failed", error_message=str(e))
            return 1


    return 0


if __name__ == "__main__":
    sys.exit(main())
