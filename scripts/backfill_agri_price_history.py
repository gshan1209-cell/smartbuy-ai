"""
模組名稱: scripts.backfill_agri_price_history
功能說明:
分段回補農業部農產品交易行情歷史資料到 Supabase。

使用方式範例：

1. 回補前一年：
   python scripts/backfill_agri_price_history.py --year-offset 1

2. 回補前二年：
   python scripts/backfill_agri_price_history.py --year-offset 2

3. 指定日期區間：
   python scripts/backfill_agri_price_history.py --start-date 2025-01-01 --end-date 2025-12-31
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import tomllib
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from src.data.fetch_agri_prices import fetch_agri_prices  # noqa: E402
from src.data.parquet_store import save_df_to_monthly_parquet  # noqa: E402


def clean_database_url(value: str) -> str:
    """清理 DATABASE_URL 可能多出的換行、空白與引號。"""
    return "".join(value.splitlines()).strip().strip('"').strip("'")


def load_database_url(raise_on_missing: bool = True) -> str | None:
    """
    讀取 DATABASE_URL。

    優先順序：
    1. 環境變數 DATABASE_URL
    2. 本機 .streamlit/secrets.toml
    """
    env_database_url = os.getenv("DATABASE_URL")

    if env_database_url:
        return clean_database_url(env_database_url)

    secrets_path = PROJECT_ROOT / ".streamlit" / "secrets.toml"

    if not secrets_path.exists():
        if raise_on_missing:
            raise FileNotFoundError(
                "找不到 DATABASE_URL。請設定環境變數 DATABASE_URL，"
                "或建立 .streamlit/secrets.toml。"
            )
        return None

    try:
        with secrets_path.open("rb") as file:
            secrets = tomllib.load(file)

        database_url = secrets.get("DATABASE_URL")

        if not database_url:
            if raise_on_missing:
                raise ValueError("secrets.toml 中找不到 DATABASE_URL。")
            return None

        return clean_database_url(database_url)
    except Exception:
        if raise_on_missing:
            raise
        return None


UPSERT_SQL = text(
    """
    INSERT INTO agri_price_daily (
        trans_date,
        crop_code,
        crop_name,
        market_code,
        market_name,
        upper_price,
        middle_price,
        lower_price,
        avg_price,
        volume,
        source,
        updated_at
    )
    VALUES (
        :trans_date,
        :crop_code,
        :crop_name,
        :market_code,
        :market_name,
        :upper_price,
        :middle_price,
        :lower_price,
        :avg_price,
        :volume,
        'MOA_FarmTransData',
        NOW()
    )
    ON CONFLICT (trans_date, crop_code, market_code)
    DO UPDATE SET
        crop_name = EXCLUDED.crop_name,
        market_name = EXCLUDED.market_name,
        upper_price = EXCLUDED.upper_price,
        middle_price = EXCLUDED.middle_price,
        lower_price = EXCLUDED.lower_price,
        avg_price = EXCLUDED.avg_price,
        volume = EXCLUDED.volume,
        source = EXCLUDED.source,
        updated_at = NOW();
    """
)


def write_log(
    conn,
    status: str,
    rows_processed: int,
    note: str | None = None,
) -> None:
    """寫入資料更新紀錄。"""
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
                'backfill_agri_price_history',
                :status,
                0,
                :rows_processed,
                :note
            );
            """
        ),
        {
            "status": status,
            "rows_processed": rows_processed,
            "note": note,
        },
    )


def parse_date(value: str) -> date:
    """將 YYYY-MM-DD 字串轉成 date。"""
    return datetime.strptime(value, "%Y-%m-%d").date()


def get_previous_year_range(year_offset: int) -> tuple[date, date]:
    """
    取得前 N 年的完整年度區間。

    例如目前是 2026：
    year_offset=1 → 2025-01-01 ~ 2025-12-31
    year_offset=2 → 2024-01-01 ~ 2024-12-31
    """
    current_year = datetime.now().year
    target_year = current_year - year_offset

    return date(target_year, 1, 1), date(target_year, 12, 31)


def upsert_records(engine, records: list[dict], batch_size: int) -> int:
    """批次 upsert 到 Supabase。"""
    processed_count = 0

    with engine.begin() as conn:
        for start in range(0, len(records), batch_size):
            batch = records[start:start + batch_size]
            conn.execute(UPSERT_SQL, batch)

            processed_count += len(batch)

            print(
                f"已批次寫入 {processed_count} / {len(records)} 筆",
                flush=True,
            )

    return processed_count


def backfill_history(
    start_date: date,
    end_date: date,
    chunk_days: int = 1,
    batch_size: int = 500,
    sleep_seconds: int = 3,
    mode: str = "both",
) -> None:
    """
    分段回補歷史資料。

    chunk_days 建議先用 1 或 2。
    政府 API 偶爾會 timeout，區間越小越穩。
    """
    # 根據 mode 載入資料庫 URL。若為 parquet 模式，資料庫 URL 遺失時不報錯（offline 模式）。
    database_url = None
    engine = None
    if mode in ("db", "both"):
        database_url = load_database_url(raise_on_missing=True)
        engine = create_engine(database_url, pool_pre_ping=True)
    else:
        database_url = load_database_url(raise_on_missing=False)
        if database_url:
            engine = create_engine(database_url, pool_pre_ping=True)

    current_start = start_date
    total_processed = 0

    print("開始歷史資料回補", flush=True)
    print(f"總區間：{start_date} ~ {end_date}", flush=True)
    print(f"每次抓取天數：{chunk_days}", flush=True)
    print(f"批次寫入大小：{batch_size}", flush=True)
    print(f"回補模式：{mode}", flush=True)

    while current_start <= end_date:
        current_end = min(
            current_start + timedelta(days=chunk_days - 1),
            end_date,
        )

        print("=" * 60, flush=True)
        print(
            f"開始回補區間：{current_start} ~ {current_end}",
            flush=True,
        )

        try:
            df = fetch_agri_prices(
                start_date=current_start,
                end_date=current_end,
            )

            print(f"本區間清洗後資料筆數：{len(df)}", flush=True)

            if df.empty:
                if engine:
                    with engine.begin() as conn:
                        write_log(
                            conn,
                            status="success",
                            rows_processed=0,
                            note=f"no data: {current_start} ~ {current_end}",
                        )

                current_start = current_end + timedelta(days=1)
                time.sleep(sleep_seconds)
                continue

            processed_count = 0

            # 寫入 Parquet 數據湖
            if mode in ("parquet", "both"):
                parquet_count = save_df_to_monthly_parquet(df)
                processed_count = len(df)
                print(f"已同步寫入/更新 Parquet 檔案共 {processed_count} 筆資料", flush=True)

            # 寫入 Supabase 資料庫
            if mode in ("db", "both") and engine:
                records = df.to_dict(orient="records")
                db_processed_count = upsert_records(
                    engine=engine,
                    records=records,
                    batch_size=batch_size,
                )
                processed_count = db_processed_count

            total_processed += processed_count

            if engine:
                with engine.begin() as conn:
                    write_log(
                        conn,
                        status="success",
                        rows_processed=processed_count,
                        note=f"backfill {current_start} ~ {current_end} (mode: {mode})",
                    )

            print(
                f"區間完成：{current_start} ~ {current_end}，"
                f"本區間 {processed_count} 筆，累計 {total_processed} 筆",
                flush=True,
            )

        except Exception as exc:
            error_message = str(exc)

            print(
                f"區間失敗：{current_start} ~ {current_end}",
                flush=True,
            )
            print(error_message, flush=True)

            if engine:
                with engine.begin() as conn:
                    write_log(
                        conn,
                        status="failed",
                        rows_processed=0,
                        note=f"backfill failed {current_start} ~ {current_end}: {error_message[:500]}",
                    )

            # 不直接中斷整個年度，先跳下一段，避免一小段失敗導致全部停止。
            current_start = current_end + timedelta(days=1)
            time.sleep(sleep_seconds)
            continue

        current_start = current_end + timedelta(days=1)
        time.sleep(sleep_seconds)

    print("=" * 60, flush=True)
    print("歷史資料回補完成。", flush=True)
    print(f"總處理筆數：{total_processed}", flush=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="回補農產品交易行情歷史資料到 Supabase 與/或 Parquet。"
    )

    parser.add_argument(
        "--year-offset",
        type=int,
        choices=[1, 2],
        help="回補前一年或前二年，例如 1=前一年，2=前二年。",
    )

    parser.add_argument(
        "--start-date",
        type=str,
        help="指定開始日期，格式 YYYY-MM-DD。",
    )

    parser.add_argument(
        "--end-date",
        type=str,
        help="指定結束日期，格式 YYYY-MM-DD。",
    )

    parser.add_argument(
        "--chunk-days",
        type=int,
        default=int(os.getenv("SMARTBUY_BACKFILL_CHUNK_DAYS", "1")),
        help="每次抓取幾天，預設 1 天。",
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("SMARTBUY_BACKFILL_BATCH_SIZE", "500")),
        help="每批寫入幾筆，預設 500。",
    )

    parser.add_argument(
        "--sleep-seconds",
        type=int,
        default=int(os.getenv("SMARTBUY_BACKFILL_SLEEP_SECONDS", "3")),
        help="每段抓取後休息秒數，預設 3 秒。",
    )

    parser.add_argument(
        "--mode",
        type=str,
        choices=["db", "parquet", "both"],
        default="both",
        help="回補模式：db (僅 Supabase), parquet (僅本機 Parquet), both (兩者，預設)。",
    )

    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()

    if args.year_offset:
        start, end = get_previous_year_range(args.year_offset)
    elif args.start_date and args.end_date:
        start = parse_date(args.start_date)
        end = parse_date(args.end_date)
    else:
        raise ValueError(
            "請指定 --year-offset 1/2，或同時指定 --start-date 與 --end-date。"
        )

    backfill_history(
        start_date=start,
        end_date=end,
        chunk_days=args.chunk_days,
        batch_size=args.batch_size,
        sleep_seconds=args.sleep_seconds,
        mode=args.mode,
    )