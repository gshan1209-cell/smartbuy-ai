"""
模組名稱: src.data.parquet_store
功能說明: 提供 Parquet 歷史資料儲存與讀取的核心工具，支援將 DataFrame 合併寫入按月分割的 Parquet 檔案。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PARQUET_DIR = PROJECT_ROOT / "data" / "history_parquet"

def save_df_to_monthly_parquet(df: pd.DataFrame) -> int:
    """
    將 pandas DataFrame 按月份儲存至分月的 Parquet 檔案中。
    如果對應的月份 Parquet 檔案已存在，會自動讀取、合併並根據
    ['trans_date', 'crop_code', 'market_code'] 鍵進行去重，保留最新的一筆。

    參數:
        df: 包含農產品行情的 pandas DataFrame。

    回傳:
        int: 寫入的資料筆數。
    """
    if df.empty:
        return 0

    df = df.copy()
    PARQUET_DIR.mkdir(parents=True, exist_ok=True)

    # 確保 trans_date 轉換成字串 'YYYY-MM-DD'，統一型態以利去重與存檔
    def format_date(d) -> str:
        if isinstance(d, (date, datetime, pd.Timestamp)):
            return d.strftime("%Y-%m-%d")
        return str(d).split(" ")[0] if " " in str(d) else str(d)

    df["trans_date"] = df["trans_date"].apply(format_date)

    # 建立一個臨時月份分組欄位 YYYY-MM
    df["year_month"] = df["trans_date"].apply(lambda d: d[:7])

    total_saved = 0

    for ym, group in df.groupby("year_month"):
        parquet_file = PARQUET_DIR / f"agri_price_{ym}.parquet"
        group_to_save = group.drop(columns=["year_month"])

        if parquet_file.exists():
            try:
                existing_df = pd.read_parquet(parquet_file)
                # 確保舊資料的 trans_date 也是字串型態
                existing_df["trans_date"] = existing_df["trans_date"].apply(format_date)
                
                # 合併
                combined_df = pd.concat([existing_df, group_to_save], ignore_index=True)
            except Exception as e:
                print(f"讀取既有 Parquet 檔案 {parquet_file} 失敗: {e}，將直接覆蓋。")
                combined_df = group_to_save
        else:
            combined_df = group_to_save

        # 根據主鍵進行去重，保留最後一筆（更新的資料）
        combined_df = combined_df.drop_duplicates(
            subset=["trans_date", "crop_code", "market_code"],
            keep="last"
        ).reset_index(drop=True)

        # 排序，讓資料結構更整齊
        combined_df = combined_df.sort_values(["trans_date", "crop_code", "market_code"]).reset_index(drop=True)

        # 寫入 Parquet 檔案，使用 pyarrow 引擎
        combined_df.to_parquet(parquet_file, index=False, engine="pyarrow")
        total_saved += len(combined_df)

    return total_saved
