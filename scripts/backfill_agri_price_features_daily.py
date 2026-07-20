"""
Backfill precomputed agri price feature rows in Supabase.

This script does not fetch MOA source data. It only calls the official
database-side feature refresh functions that populate
public.agri_price_features_daily from public.agri_price_daily.

Default mode is dry-run. Add --execute to write to Supabase.
"""

from __future__ import annotations

import argparse
import os
from datetime import date, datetime, timedelta
from typing import Iterator

from sqlalchemy import create_engine, text


def clean_database_url(value: str) -> str:
    return "".join(value.splitlines()).strip().strip('"').strip("'")


def load_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise FileNotFoundError("DATABASE_URL is required.")
    return clean_database_url(database_url)


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def iter_date_chunks(
    start_date: date,
    end_date: date,
    chunk_days: int,
) -> Iterator[tuple[date, date]]:
    if chunk_days < 1:
        raise ValueError("chunk_days must be greater than or equal to 1.")
    if start_date > end_date:
        raise ValueError("start_date must be less than or equal to end_date.")

    current_start = start_date
    while current_start <= end_date:
        current_end = min(current_start + timedelta(days=chunk_days - 1), end_date)
        yield current_start, current_end
        current_start = current_end + timedelta(days=1)


def inspect_missing_30_day_features(conn, start_date: date, end_date: date) -> dict[str, object]:
    """
    Read-only count of rows whose 30-trading-day source window is complete
    but any stored 30-day feature column is NULL.
    """
    result = conn.execute(
        text(
            """
            WITH valid_source AS (
                SELECT
                    trans_date::date AS trade_date,
                    market_code::text AS market_id,
                    crop_code::text AS crop_id,
                    avg_price::double precision AS avg_price,
                    volume::double precision AS volume
                FROM public.agri_price_daily
                WHERE trans_date IS NOT NULL
                  AND market_code IS NOT NULL
                  AND crop_code IS NOT NULL
                  AND avg_price > 0
                  AND volume > 0
            ),
            expected AS (
                SELECT
                    trade_date,
                    market_id,
                    crop_id,
                    COUNT(avg_price) OVER window_30 AS price_count_30,
                    COUNT(volume) OVER window_30 AS volume_count_30
                FROM valid_source
                WINDOW window_30 AS (
                    PARTITION BY market_id, crop_id
                    ORDER BY trade_date
                    ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                )
            ),
            joined_rows AS (
                SELECT
                    feature_rows.trade_date,
                    feature_rows.price_ma_30,
                    feature_rows.price_std_30,
                    feature_rows.volume_ma_30,
                    feature_rows.volume_std_30,
                    expected.price_count_30,
                    expected.volume_count_30
                FROM public.agri_price_features_daily feature_rows
                JOIN expected USING (trade_date, market_id, crop_id)
                WHERE feature_rows.trade_date BETWEEN :start_date AND :end_date
            )
            SELECT
                COUNT(*) FILTER (
                    WHERE price_count_30 = 30
                      AND price_ma_30 IS NULL
                )::integer AS missing_price_ma_30,
                COUNT(*) FILTER (
                    WHERE price_count_30 = 30
                      AND price_std_30 IS NULL
                )::integer AS missing_price_std_30,
                COUNT(*) FILTER (
                    WHERE volume_count_30 = 30
                      AND volume_ma_30 IS NULL
                )::integer AS missing_volume_ma_30,
                COUNT(*) FILTER (
                    WHERE volume_count_30 = 30
                      AND volume_std_30 IS NULL
                )::integer AS missing_volume_std_30,
                MIN(trade_date) FILTER (
                    WHERE (price_count_30 = 30 AND (price_ma_30 IS NULL OR price_std_30 IS NULL))
                       OR (volume_count_30 = 30 AND (volume_ma_30 IS NULL OR volume_std_30 IS NULL))
                ) AS min_affected_date,
                MAX(trade_date) FILTER (
                    WHERE (price_count_30 = 30 AND (price_ma_30 IS NULL OR price_std_30 IS NULL))
                       OR (volume_count_30 = 30 AND (volume_ma_30 IS NULL OR volume_std_30 IS NULL))
                ) AS max_affected_date
            FROM joined_rows;
            """
        ),
        {"start_date": start_date, "end_date": end_date},
    ).mappings().first()

    return dict(result) if result else {}


def refresh_feature_chunk(conn, start_date: date, end_date: date) -> dict[str, object] | None:
    result = conn.execute(
        text(
            """
            SELECT
                upserted_rows,
                deleted_stale_rows,
                feature_computed_at
            FROM public.refresh_agri_price_features(:start_date, :end_date);
            """
        ),
        {"start_date": start_date, "end_date": end_date},
    ).mappings().first()

    return dict(result) if result else None


def run_feature_backfill(
    start_date: date,
    end_date: date,
    chunk_days: int,
    execute: bool,
) -> None:
    database_url = load_database_url()
    engine = create_engine(database_url, pool_pre_ping=True)

    if execute:
        for chunk_start, chunk_end in iter_date_chunks(start_date, end_date, chunk_days):
            with engine.begin() as conn:
                refresh_result = refresh_feature_chunk(conn, chunk_start, chunk_end)
            print(
                "feature refresh "
                f"{chunk_start}..{chunk_end}: {refresh_result}",
                flush=True,
            )
        return

    with engine.begin() as conn:
        conn.execute(text("SET TRANSACTION READ ONLY;"))
        inspection = inspect_missing_30_day_features(conn, start_date, end_date)

    print(
        "dry-run missing 30-day feature summary "
        f"{start_date}..{end_date}: {inspection}",
        flush=True,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill public.agri_price_features_daily from public.agri_price_daily."
    )
    parser.add_argument("--start-date", required=True, type=parse_date)
    parser.add_argument("--end-date", required=True, type=parse_date)
    parser.add_argument(
        "--chunk-days",
        type=int,
        default=int(os.getenv("SMARTBUY_FEATURE_BACKFILL_CHUNK_DAYS", "14")),
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write by calling public.refresh_agri_price_features(start_date, end_date).",
    )
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    run_feature_backfill(
        start_date=args.start_date,
        end_date=args.end_date,
        chunk_days=args.chunk_days,
        execute=args.execute,
    )
