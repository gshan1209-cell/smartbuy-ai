from __future__ import annotations

from datetime import date

import pytest

from scripts.backfill_agri_price_features_daily import (
    iter_date_chunks,
    refresh_feature_chunk,
)


class _FakeResult:
    def mappings(self):
        return self

    def first(self):
        return {
            "upserted_rows": 12,
            "deleted_stale_rows": 0,
            "feature_computed_at": "2026-07-20T00:00:00+00:00",
        }


class _FakeConnection:
    def __init__(self):
        self.executed_sql = ""
        self.parameters = None

    def execute(self, statement, parameters=None):
        self.executed_sql = str(statement)
        self.parameters = parameters
        return _FakeResult()


def test_iter_date_chunks_splits_inclusive_ranges():
    chunks = list(
        iter_date_chunks(
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 13),
            chunk_days=5,
        )
    )

    assert chunks == [
        (date(2026, 7, 1), date(2026, 7, 5)),
        (date(2026, 7, 6), date(2026, 7, 10)),
        (date(2026, 7, 11), date(2026, 7, 13)),
    ]


def test_iter_date_chunks_rejects_invalid_ranges():
    with pytest.raises(ValueError, match="chunk_days"):
        list(iter_date_chunks(date(2026, 7, 1), date(2026, 7, 2), 0))

    with pytest.raises(ValueError, match="start_date"):
        list(iter_date_chunks(date(2026, 7, 2), date(2026, 7, 1), 1))


def test_refresh_feature_chunk_calls_official_incremental_function():
    conn = _FakeConnection()

    result = refresh_feature_chunk(
        conn,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 13),
    )

    assert "FROM public.refresh_agri_price_features(:start_date, :end_date)" in conn.executed_sql
    assert conn.parameters == {
        "start_date": date(2026, 7, 1),
        "end_date": date(2026, 7, 13),
    }
    assert result == {
        "upserted_rows": 12,
        "deleted_stale_rows": 0,
        "feature_computed_at": "2026-07-20T00:00:00+00:00",
    }
