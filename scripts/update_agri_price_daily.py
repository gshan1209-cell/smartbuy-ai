"""
模組名稱: scripts.update_agri_price_daily
功能說明: 抓取農業部農產品交易行情資料，並寫入 Supabase agri_price_daily。
"""

from __future__ import annotations

from pathlib import Path
import sys
import os
import tomllib

from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from src.data.fetch_agri_prices import fetch_agri_prices  # noqa: E402
from src.data.parquet_store import save_df_to_monthly_parquet  # noqa: E402


def load_database_url(raise_on_missing: bool = True) -> str | None:
    """
    讀取 DATABASE_URL。

    優先順序：
    1. GitHub Actions / 雲端環境變數 DATABASE_URL
    2. 本機 .streamlit/secrets.toml

    注意：
    .streamlit/secrets.toml 不可以 commit 到 GitHub。
    """
    env_database_url = os.getenv("DATABASE_URL")

    if env_database_url:
        return env_database_url

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

        return database_url
    except Exception:
        if raise_on_missing:
            raise
        return None


def write_log(
    conn,
    status: str,
    rows_inserted: int = 0,
    rows_updated: int = 0,
    error_message: str | None = None,
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
                'update_agri_price_daily',
                :status,
                :rows_inserted,
                :rows_updated,
                :error_message
            );
            """
        ),
        {
            "status": status,
            "rows_inserted": rows_inserted,
            "rows_updated": rows_updated,
            "error_message": error_message,
        },
    )


def upsert_agri_prices() -> None:
    """
    抓取農產品交易行情，並以 upsert 寫入 agri_price_daily。
    同時將資料寫入本機 Parquet 歷史儲存層，並清理 Supabase 中超過 3 個月的過期資料。

    判斷依據：
    trans_date + crop_code + market_code
    """
    print("開始讀取 DATABASE_URL...", flush=True)
    database_url = load_database_url(raise_on_missing=False)
    engine = None
    if database_url:
        print("建立資料庫 engine...", flush=True)
        engine = create_engine(database_url, pool_pre_ping=True)
    else:
        print("未偵測到 DATABASE_URL，將以離線模式執行（僅寫入 Parquet 檔案）。", flush=True)

    print("開始抓取農業部農產品交易行情 API...", flush=True)
    df = fetch_agri_prices()
    print(f"API 抓取完成，資料筆數：{len(df)}", flush=True)

    if df.empty:
        if engine:
            with engine.begin() as conn:
                write_log(
                    conn,
                    status="failed",
                    error_message="API 有回應，但整理後沒有可寫入資料。",
                )

        print("沒有可寫入資料。")
        return

    # 1. 寫入本機 Parquet 歷史儲存層
    print("開始寫入本機 Parquet 歷史資料...", flush=True)
    parquet_saved = save_df_to_monthly_parquet(df)
    print(f"本機 Parquet 歷史資料更新完成，共寫入/更新 {len(df)} 筆資料。", flush=True)

    # 2. 寫入 Supabase 資料庫與清理舊資料
    if engine:
        insert_count = 0
        update_count = 0
        print("開始寫入 Supabase agri_price_daily...", flush=True)

        upsert_sql = text(
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

        exists_sql = text(
            """
            SELECT 1
            FROM agri_price_daily
            WHERE trans_date = :trans_date
              AND crop_code = :crop_code
              AND market_code = :market_code
            LIMIT 1;
            """
        )

        prune_sql = text(
            """
            DELETE FROM agri_price_daily
            WHERE trans_date < CURRENT_DATE - INTERVAL '90 days';
            """
        )

        try:
            with engine.begin() as conn:
                for index, row in enumerate(df.to_dict(orient="records"), start=1):
                    exists = conn.execute(
                        exists_sql,
                        {
                            "trans_date": row["trans_date"],
                            "crop_code": row["crop_code"],
                            "market_code": row["market_code"],
                        },
                    ).first()

                    conn.execute(upsert_sql, row)

                    if exists:
                        update_count += 1
                    else:
                        insert_count += 1
                    if index % 500 == 0:
                        print(f"已處理 {index} 筆資料...", flush=True)

                # 清理 90 天前歷史舊資料
                print("開始清理 Supabase 超過 90 天的歷史資料...", flush=True)
                prune_result = conn.execute(prune_sql)
                pruned_rows = prune_result.rowcount
                print(f"歷史資料清理完成，已刪除 {pruned_rows} 筆過期資料。", flush=True)

                write_log(
                    conn,
                    status="success",
                    rows_inserted=insert_count,
                    rows_updated=update_count,
                    error_message=f"pruned_rows: {pruned_rows}",
                )

            print("農產品交易行情更新完成。", flush=True)
            print(f"新增筆數：{insert_count}", flush=True)
            print(f"更新筆數：{update_count}", flush=True)

        except Exception as exc:
            with engine.begin() as conn:
                write_log(
                    conn,
                    status="failed",
                    error_message=str(exc),
                )

            raise
    else:
        print("未配置資料庫連線，跳過 Supabase 寫入與歷史清理。", flush=True)


if __name__ == "__main__":
    upsert_agri_prices()