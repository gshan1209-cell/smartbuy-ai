# -*- coding: utf-8 -*-
"""
單元測試: tests.test_agri_price_features_sql
功能說明: 驗證農產品每日特徵 SQL 契約與每日更新管線的 refresh 呼叫。
"""
from __future__ import annotations

from pathlib import Path

from scripts.update_agri_price_daily import refresh_agri_price_features


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = PROJECT_ROOT / "scripts" / "create_agri_price_features_daily.sql"
UPDATE_SCRIPT_PATH = PROJECT_ROOT / "scripts" / "update_agri_price_daily.py"
WORKFLOW_PATH = PROJECT_ROOT / ".github" / "workflows" / "daily_agri_price_update.yml"


def _sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


def _update_script() -> str:
    return UPDATE_SCRIPT_PATH.read_text(encoding="utf-8")


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_feature_sql_uses_expected_source_mapping_and_layers():
    sql = _sql()

    assert "FROM public.agri_price_daily" in sql
    assert "trans_date::date AS trade_date" in sql
    assert "market_code::text AS market_id" in sql
    assert "crop_code::text AS crop_id" in sql

    for layer in [
        "valid_source AS",
        "lag_features AS",
        "rolling_raw AS",
        "rolling_complete AS",
        "derived_features AS",
        "final_feature_rows AS",
    ]:
        assert layer in sql


def test_feature_sql_defines_incremental_refresh_contract():
    sql = _sql()
    incremental_sql = sql.split("CREATE OR REPLACE FUNCTION public.refresh_agri_price_features_full()")[0]

    assert "CREATE OR REPLACE FUNCTION public.refresh_agri_price_features(" in sql
    assert "p_start_date DATE" in sql
    assert "p_end_date DATE" in sql
    assert "CREATE OR REPLACE FUNCTION public.refresh_agri_price_features_full()" in sql
    assert "idx_agri_price_daily_feature_lookup_desc" in sql
    assert "LEFT JOIN LATERAL" in sql
    assert "WITH changed_rows AS" in incremental_sql
    assert "future_refresh_rows AS" in incremental_sql
    assert "source_rows.trans_date > changed.trade_date" in incremental_sql
    assert "LIMIT 14" in incremental_sql
    assert "FROM valid_refresh_rows refresh_rows" in incremental_sql
    assert "FROM final_feature_rows final_rows" in incremental_sql
    assert "valid_source AS" not in incremental_sql
    assert "FROM final_feature_rows final_rows" not in incremental_sql.split("valid_refresh_rows AS")[0]
    assert "FROM public.refresh_agri_price_features(CURRENT_DATE, CURRENT_DATE)" in sql
    assert (
        "REVOKE ALL ON FUNCTION public.refresh_agri_price_features(DATE, DATE) FROM PUBLIC, anon, authenticated"
        in sql
    )


def test_feature_sql_and_workflow_timeouts_are_extended():
    sql = _sql()
    workflow = _workflow()

    assert "SET statement_timeout = '30min'" in sql
    assert "SET statement_timeout = '10min'" not in sql
    assert "timeout-minutes: 120" in workflow
    assert "timeout-minutes: 60" not in workflow


def test_daily_pipeline_passes_api_date_range_to_incremental_refresh():
    update_script = _update_script()

    assert 'feature_start_date = df["trans_date"].min()' in update_script
    assert 'feature_end_date = df["trans_date"].max()' in update_script
    assert "start_date=feature_start_date" in update_script
    assert "end_date=feature_end_date" in update_script


def test_feature_sql_matches_notebook_window_semantics():
    sql = _sql()

    assert "PARTITION BY market_id, crop_id" in sql
    assert "ORDER BY trade_date" in sql
    assert "LAG(avg_price, 14)" in sql
    assert "LAG(volume, 14)" in sql
    assert "ROWS BETWEEN 6 PRECEDING AND CURRENT ROW" in sql
    assert "ROWS BETWEEN 13 PRECEDING AND CURRENT ROW" in sql
    assert "STDDEV_POP(avg_price)" in sql
    assert "STDDEV_SAMP" not in sql
    assert "price_count_7 = 7" in sql
    assert "price_count_14 = 14" in sql
    assert "avg_price / NULLIF(price_lag_14, 0) - 1" in sql
    assert "volume / NULLIF(volume_lag_7, 0) - 1" in sql
    assert "EXTRACT(ISODOW FROM trade_date)::smallint - 1" in sql
    assert "EXTRACT(MONTH FROM trade_date)::smallint" in sql


def test_feature_sql_defines_api_permissions_without_write_grants():
    sql = _sql()

    assert "CREATE OR REPLACE VIEW public.api_agri_price_features_latest" in sql
    assert "CREATE OR REPLACE FUNCTION public.get_agri_price_feature_history" in sql
    assert "REVOKE ALL ON public.agri_price_features_daily FROM PUBLIC, anon, authenticated" in sql
    assert "GRANT SELECT ON public.api_agri_price_features_latest TO anon, authenticated" in sql
    assert (
        "GRANT EXECUTE ON FUNCTION public.get_agri_price_feature_history(TEXT, TEXT, DATE, DATE, INTEGER)"
        in sql
    )
    assert "REVOKE ALL ON FUNCTION public.refresh_agri_price_features() FROM PUBLIC, anon, authenticated" in sql


def test_feature_sql_excludes_training_and_cycle_columns():
    sql = _sql()

    forbidden_columns = [
        "month_sin",
        "month_cos",
        "next_trade_date",
        "next_avg_price",
        "next_return",
        "label_direction",
        "label_name",
        "target",
    ]
    for column in forbidden_columns:
        assert column not in sql


class _FakeResult:
    def mappings(self):
        return self

    def first(self):
        return {
            "upserted_rows": 20,
            "deleted_stale_rows": 0,
            "feature_computed_at": "2026-07-13T00:00:00+00:00",
        }


class _FakeConnection:
    def __init__(self):
        self.executed_sql = ""
        self.parameters = None

    def execute(self, statement, parameters=None):
        self.executed_sql = str(statement)
        self.parameters = parameters
        return _FakeResult()


def test_refresh_agri_price_features_calls_database_function():
    conn = _FakeConnection()

    result = refresh_agri_price_features(conn)

    assert "FROM public.refresh_agri_price_features()" in conn.executed_sql
    assert result == {
        "upserted_rows": 20,
        "deleted_stale_rows": 0,
        "feature_computed_at": "2026-07-13T00:00:00+00:00",
    }


def test_refresh_agri_price_features_calls_incremental_database_function_with_dates():
    conn = _FakeConnection()

    result = refresh_agri_price_features(
        conn,
        start_date="2026-07-13",
        end_date="2026-07-14",
    )

    assert "FROM public.refresh_agri_price_features(:start_date, :end_date)" in conn.executed_sql
    assert conn.parameters == {
        "start_date": "2026-07-13",
        "end_date": "2026-07-14",
    }
    assert result == {
        "upserted_rows": 20,
        "deleted_stale_rows": 0,
        "feature_computed_at": "2026-07-13T00:00:00+00:00",
    }
