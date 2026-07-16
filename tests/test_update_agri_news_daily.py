from __future__ import annotations

from copy import deepcopy
from datetime import date
import hashlib
from pathlib import Path

import pytest

from scripts import update_agri_news_daily as script


SQL_PATH = Path("scripts/create_agri_news_articles_table.sql")
MIGRATION_PATH = Path("scripts/migrations/extend_agri_news_sources.sql")


def make_article(
    *,
    key: str = "article-1",
    source_name: str = "農業部",
    title: str = "測試新聞",
    url: str = "https://example.test/news/1",
    content: str | None = "測試正文",
    parse_status: str = "success",
    parse_error: str | None = None,
) -> dict:
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest() if content else None
    return {
        "article_key": key,
        "source_name": source_name,
        "source_article_id": "1001",
        "title": title,
        "published_date": "2026-07-12",
        "source_url": url,
        "content_text": content,
        "content_hash": content_hash,
        "parse_status": parse_status,
        "parse_error": parse_error,
    }


class FakeResult:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []

    def first(self):
        return self.row

    def mappings(self):
        return self

    def all(self):
        return self.rows


class FakeConnection:
    def __init__(self, state):
        self.state = state

    def execute(self, statement, params=None):
        params = dict(params or {})
        sql = str(statement).lower()

        if "select" in sql and "from public.agri_news_articles" in sql:
            row = self.state["articles"].get(params["article_key"])
            return FakeResult(deepcopy(row) if row else None)

        if "from public.agri_price_daily" in sql:
            rows = self.state.get("prices", [])
            latest_date = max((row["trans_date"] for row in rows), default=None)
            totals = {}
            for row in rows:
                crop_name = row.get("crop_name")
                crop_name = crop_name.strip() if isinstance(crop_name, str) else crop_name
                if row.get("trans_date") != latest_date or not crop_name:
                    continue
                totals[crop_name] = totals.get(crop_name, 0) + (row.get("volume") or 0)
            result_rows = [
                {
                    "latest_trade_date": latest_date,
                    "crop_name": crop_name,
                    "total_volume": total_volume,
                }
                for crop_name, total_volume in totals.items()
            ]
            result_rows.sort(key=lambda row: (-row["total_volume"], row["crop_name"]))
            return FakeResult(rows=result_rows)

        if "insert into public.agri_news_articles" in sql:
            if self.state.get("fail_article_write"):
                raise RuntimeError("database write failed")
            row = deepcopy(params)
            row["id"] = self.state["next_id"]
            row["first_fetched_at"] = f"first-{row['id']}"
            row["last_fetched_at"] = f"last-{row['id']}"
            row["updated_at"] = f"updated-{row['id']}"
            self.state["next_id"] += 1
            self.state["articles"][row["article_key"]] = row
            return FakeResult()

        if "update public.agri_news_articles" in sql and "updated_at = now()" in sql:
            existing = self.state["articles"][params["article_key"]]
            first_fetched_at = existing["first_fetched_at"]
            row_id = existing["id"]
            updated = deepcopy(params)
            updated["id"] = row_id
            updated["first_fetched_at"] = first_fetched_at
            updated["last_fetched_at"] = f"last-touch-{row_id}"
            updated["updated_at"] = f"updated-touch-{row_id}"
            self.state["articles"][params["article_key"]] = updated
            return FakeResult()

        if "update public.agri_news_articles" in sql and "last_fetched_at = now()" in sql:
            existing = self.state["articles"][params["article_key"]]
            existing["last_fetched_at"] = f"last-touch-{existing['id']}"
            return FakeResult()

        if "insert into public.data_update_logs" in sql:
            self.state["logs"].append(deepcopy(params))
            return FakeResult()

        raise AssertionError(f"unexpected SQL: {statement}")


class FakeTransaction:
    def __init__(self, engine):
        self.engine = engine

    def __enter__(self):
        self.snapshot = deepcopy(self.engine.state)
        return FakeConnection(self.engine.state)

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            self.engine.state.clear()
            self.engine.state.update(self.snapshot)
        return False


class FakeEngine:
    def __init__(self):
        self.state = {
            "articles": {},
            "logs": [],
            "next_id": 1,
            "fail_article_write": False,
            "prices": [],
        }

    def begin(self):
        return FakeTransaction(self)


def test_create_table_sql_contains_required_schema():
    sql = SQL_PATH.read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS public.agri_news_articles" in sql
    for column in [
        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY",
        "article_key TEXT NOT NULL UNIQUE",
        "source_name TEXT NOT NULL",
        "source_article_id TEXT",
        "title TEXT NOT NULL",
        "published_date DATE",
        "source_url TEXT NOT NULL UNIQUE",
        "content_text TEXT",
        "content_hash TEXT",
        "parse_status TEXT NOT NULL",
        "parse_error TEXT",
        "first_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    ]:
        assert column in sql

    assert "CHECK (BTRIM(source_name) <> '')" in sql
    assert "CHECK (parse_status IN ('success', 'partial', 'failed'))" in sql
    assert "CHECK (content_hash IS NULL OR char_length(content_hash) = 64)" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_agri_news_articles_published_date_desc" in sql
    assert "published_date DESC" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_agri_news_articles_source_name" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_agri_news_articles_parse_status" in sql


def test_create_table_sql_has_no_destructive_statements():
    sql = SQL_PATH.read_text(encoding="utf-8").lower()

    assert "drop" not in sql
    assert "truncate" not in sql
    assert "delete from" not in sql


def test_extend_sources_migration_only_changes_source_check_and_is_not_destructive():
    sql = MIGRATION_PATH.read_text(encoding="utf-8").lower()

    assert "agri_news_articles_source_name_check" in sql
    assert "btrim(source_name) <> ''" in sql
    assert "drop table" not in sql
    assert "truncate" not in sql
    assert "delete" not in sql


def test_new_article_counts_as_inserted():
    engine = FakeEngine()

    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [make_article()])

    assert stats["rows_inserted"] == 1
    assert len(engine.state["articles"]) == 1


def test_dynamic_source_name_passes_validation_and_upsert():
    engine = FakeEngine()
    article = make_article(source_name="自由時報", key="article-free", url="https://example.test/free")

    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [article])

    assert stats["rows_inserted"] == 1
    assert engine.state["articles"]["article-free"]["source_name"] == "自由時報"


def test_blank_source_name_is_rejected():
    article = make_article(source_name=" ")

    with pytest.raises(ValueError, match="source_name"):
        script.validate_article(article)


def test_same_article_rerun_is_idempotent_and_not_updated():
    engine = FakeEngine()

    with engine.begin() as conn:
        script.upsert_articles(conn, [make_article()])
    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [make_article()])

    assert len(engine.state["articles"]) == 1
    assert stats["rows_inserted"] == 0
    assert stats["rows_updated"] == 0
    assert stats["rows_unchanged"] == 1


def test_title_or_content_hash_change_counts_as_updated():
    engine = FakeEngine()

    with engine.begin() as conn:
        script.upsert_articles(conn, [make_article()])
    changed = make_article(title="改版測試新聞", content="新版正文")
    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [changed])

    assert stats["rows_updated"] == 1
    assert engine.state["articles"]["article-1"]["title"] == "改版測試新聞"
    assert engine.state["articles"]["article-1"]["content_hash"] == changed["content_hash"]


def test_temporary_parse_failure_does_not_overwrite_existing_success_content():
    engine = FakeEngine()
    original = make_article(content="既有成功正文")

    with engine.begin() as conn:
        script.upsert_articles(conn, [original])
    failed = make_article(content=None, parse_status="failed", parse_error="temporary error")
    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [failed])

    stored = engine.state["articles"]["article-1"]
    assert stats["rows_updated"] == 0
    assert stats["rows_unchanged"] == 1
    assert stored["content_text"] == "既有成功正文"
    assert stored["content_hash"] == original["content_hash"]
    assert stored["parse_status"] == "success"


def test_first_parse_failure_still_saves_basic_article_data():
    engine = FakeEngine()
    failed = make_article(content=None, parse_status="failed", parse_error="selector missing")

    with engine.begin() as conn:
        stats = script.upsert_articles(conn, [failed])

    stored = engine.state["articles"]["article-1"]
    assert stats["rows_inserted"] == 1
    assert stored["title"] == "測試新聞"
    assert stored["content_text"] is None
    assert stored["parse_status"] == "failed"
    assert stored["parse_error"] == "selector missing"


def test_single_source_or_article_failure_writes_partial_success(monkeypatch):
    engine = FakeEngine()
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example/db")
    monkeypatch.setattr(script, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(
        script,
        "fetch_agri_news",
        lambda limit_per_source, yahoo_keywords: [
            {**make_article(source_name="農業部", parse_status="failed", content=None), "crawl_source": "moa"},
        ],
    )

    result = script.run_pipeline(limit_per_source=10)

    assert result["status"] == "partial_success"
    assert engine.state["logs"][-1]["status"] == "partial_success"
    assert engine.state["logs"][-1]["rows_inserted"] == 1


def test_no_articles_fails_pipeline_and_writes_failed_log(monkeypatch):
    engine = FakeEngine()
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example/db")
    monkeypatch.setattr(script, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(script, "fetch_agri_news", lambda limit_per_source, yahoo_keywords: [])

    with pytest.raises(RuntimeError, match="returned no articles"):
        script.run_pipeline(limit_per_source=10)

    assert engine.state["articles"] == {}
    assert engine.state["logs"][-1]["status"] == "failed"


def test_database_write_exception_rolls_back_news_and_records_failed_log(monkeypatch):
    engine = FakeEngine()
    engine.state["fail_article_write"] = True
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example/db")
    monkeypatch.setattr(script, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(
        script,
        "fetch_agri_news",
        lambda limit_per_source, yahoo_keywords: [{**make_article(), "crawl_source": "moa"}],
    )

    with pytest.raises(RuntimeError, match="database write failed"):
        script.run_pipeline(limit_per_source=10)

    assert engine.state["articles"] == {}
    assert len(engine.state["logs"]) == 1
    assert engine.state["logs"][0]["status"] == "failed"
    assert "database write failed" in engine.state["logs"][0]["error_message"]


def test_latest_ranked_crop_query_uses_latest_date_aggregates_and_sorts():
    engine = FakeEngine()
    engine.state["prices"] = [
        {"trans_date": "2026-07-14", "crop_name": "芒果", "volume": 999},
        {"trans_date": "2026-07-15", "crop_name": "香蕉", "volume": 5},
        {"trans_date": "2026-07-15", "crop_name": "芒果", "volume": 4},
        {"trans_date": "2026-07-15", "crop_name": "芒果", "volume": 7},
        {"trans_date": "2026-07-15", "crop_name": "  香蕉  ", "volume": 6},
        {"trans_date": "2026-07-15", "crop_name": "蘋果", "volume": 11},
        {"trans_date": "2026-07-15", "crop_name": "", "volume": 1000},
        {"trans_date": "2026-07-15", "crop_name": None, "volume": 1000},
    ]

    with engine.begin() as conn:
        result = script.fetch_latest_ranked_crop_names(conn)

    assert result == {
        "latest_trade_date": "2026-07-15",
        "crop_names": ["芒果", "蘋果", "香蕉"],
    }


def test_latest_ranked_crop_query_returns_all_latest_date_crops_without_limit_50():
    engine = FakeEngine()
    engine.state["prices"] = [
        {"trans_date": "2026-07-15", "crop_name": f"作物{i:02d}", "volume": i}
        for i in range(60)
    ]

    with engine.begin() as conn:
        result = script.fetch_latest_ranked_crop_names(conn)

    assert len(result["crop_names"]) == 60
    assert result["crop_names"][0] == "作物59"
    assert result["crop_names"][-1] == "作物00"


def test_ranked_crop_sql_has_no_fixed_limit_50_and_orders_in_database():
    sql = str(script.LATEST_RANKED_CROP_NAMES_SQL).lower()

    assert "max(trans_date)" in sql
    assert "join latest_date" in sql
    assert "group by" in sql
    assert "sum(coalesce(agri_price_daily.volume, 0))" in sql
    assert "order by" in sql
    assert "total_volume desc" in sql
    assert "agri_price_daily.crop_name asc" in sql
    assert "limit 50" not in sql
    assert "limit :limit" not in sql


def _crop_names(count):
    return [f"作物{i:03d}" for i in range(1, count + 1)]


def test_select_daily_yahoo_keywords_keeps_top_50_fixed():
    ranked = _crop_names(130)
    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )

    assert selection["fixed_keywords"] == ranked[:50]
    assert selection["keywords"][:50] == ranked[:50]


def test_select_daily_yahoo_keywords_batches_remaining_crops_by_100():
    ranked = _crop_names(180)
    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 14),
    )

    assert selection["remaining_crop_count"] == 130
    assert selection["rotation_batch_count"] == 2
    assert len(selection["rotating_keywords"]) in {30, 100}
    batch_index = selection["rotation_batch_index"]
    start = 50 + batch_index * 100
    assert selection["rotating_keywords"] == ranked[start : start + 100]


def test_select_daily_yahoo_keywords_same_date_is_stable_and_next_date_advances():
    ranked = _crop_names(180)
    today = script.select_daily_yahoo_keywords(ranked, rotation_date=date(2026, 7, 15))
    rerun = script.select_daily_yahoo_keywords(ranked, rotation_date=date(2026, 7, 15))
    tomorrow = script.select_daily_yahoo_keywords(ranked, rotation_date=date(2026, 7, 16))

    assert today["rotating_keywords"] == rerun["rotating_keywords"]
    assert tomorrow["rotation_batch_index"] == (
        today["rotation_batch_index"] + 1
    ) % today["rotation_batch_count"]


def test_select_daily_yahoo_keywords_wraps_after_last_batch():
    ranked = _crop_names(180)
    batch_count = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )["rotation_batch_count"]
    last_day = date.fromordinal(batch_count - 1)
    wrapped_day = date.fromordinal(batch_count)

    last_selection = script.select_daily_yahoo_keywords(ranked, rotation_date=last_day)
    wrapped_selection = script.select_daily_yahoo_keywords(ranked, rotation_date=wrapped_day)

    assert last_selection["rotation_batch_index"] == batch_count - 1
    assert wrapped_selection["rotation_batch_index"] == 0


def test_select_daily_yahoo_keywords_last_batch_does_not_backfill():
    ranked = _crop_names(180)
    last_batch_date = date.fromordinal(1)

    selection = script.select_daily_yahoo_keywords(ranked, rotation_date=last_batch_date)

    assert selection["rotation_batch_count"] == 2
    assert selection["rotation_batch_index"] == 1
    assert selection["rotating_keywords"] == ranked[150:180]
    assert len(selection["keywords"]) == 80


@pytest.mark.parametrize("count", [0, 1, 50])
def test_select_daily_yahoo_keywords_no_rotation_when_total_is_at_most_50(count):
    ranked = _crop_names(count)

    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )

    assert selection["fixed_keywords"] == ranked
    assert selection["rotating_keywords"] == []
    assert selection["rotation_batch_index"] == 0
    assert selection["rotation_batch_count"] == 0
    assert selection["keywords"] == ranked


def test_select_daily_yahoo_keywords_51_to_150_includes_all_remaining():
    ranked = _crop_names(150)

    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )

    assert selection["fixed_keywords"] == ranked[:50]
    assert selection["rotating_keywords"] == ranked[50:]
    assert len(selection["keywords"]) == 150
    assert selection["rotation_batch_count"] == 1


def test_select_daily_yahoo_keywords_caps_daily_selection_at_150():
    ranked = _crop_names(250)

    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )

    assert len(selection["fixed_keywords"]) == 50
    assert len(selection["rotating_keywords"]) == 100
    assert len(selection["keywords"]) == 150


def test_select_daily_yahoo_keywords_692_crops_uses_six_full_batches_and_one_short_batch():
    ranked = _crop_names(692)

    selections = [
        script.select_daily_yahoo_keywords(
            ranked,
            rotation_date=date.fromordinal(7 + batch_index),
        )
        for batch_index in range(7)
    ]

    assert selections[0]["total_crop_count"] == 692
    assert selections[0]["remaining_crop_count"] == 642
    assert selections[0]["rotation_batch_count"] == 7
    for selection in selections[:6]:
        assert len(selection["fixed_keywords"]) == 50
        assert len(selection["rotating_keywords"]) == 100
        assert len(selection["keywords"]) == 150

    last_selection = selections[6]
    assert len(last_selection["fixed_keywords"]) == 50
    assert len(last_selection["rotating_keywords"]) == 42
    assert len(last_selection["keywords"]) == 92
    assert last_selection["rotating_keywords"] == ranked[650:692]


def test_select_daily_yahoo_keywords_removes_blanks_and_duplicates():
    ranked = [" 芒果 ", "", "香蕉", "芒果", "  ", "蘋果", "香蕉"]

    selection = script.select_daily_yahoo_keywords(
        ranked,
        rotation_date=date(2026, 7, 15),
    )

    assert selection["keywords"] == ["芒果", "香蕉", "蘋果"]
    assert len(selection["keywords"]) == len(set(selection["keywords"]))
    assert all(keyword.strip() for keyword in selection["keywords"])


def test_run_pipeline_selects_rotated_keywords_and_passes_them_to_yahoo(monkeypatch, capsys):
    engine = FakeEngine()
    engine.state["prices"] = [
        {"trans_date": "2026-07-15", "crop_name": f"作物{i:03d}", "volume": 300 - i}
        for i in range(1, 201)
    ]
    captured = {}
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example/db")
    monkeypatch.setattr(script, "create_engine", lambda *args, **kwargs: engine)
    select_daily_yahoo_keywords = script.select_daily_yahoo_keywords
    monkeypatch.setattr(
        script,
        "select_daily_yahoo_keywords",
        lambda ranked_crop_names: {
            **select_daily_yahoo_keywords(
                ranked_crop_names,
                rotation_date=date(2026, 7, 15),
            ),
        },
    )

    def fake_fetch_agri_news(limit_per_source, yahoo_keywords):
        captured["limit_per_source"] = limit_per_source
        captured["yahoo_keywords"] = yahoo_keywords
        return [
            {
                **make_article(source_name="自由時報", key="article-yahoo", url="https://example.test/yahoo"),
                "crawl_source": "yahoo",
            }
        ]

    monkeypatch.setattr(script, "fetch_agri_news", fake_fetch_agri_news)

    result = script.run_pipeline(limit_per_source=7)

    expected_selection = select_daily_yahoo_keywords(
        [f"作物{i:03d}" for i in range(1, 201)],
        rotation_date=date(2026, 7, 15),
    )
    assert captured == {
        "limit_per_source": 7,
        "yahoo_keywords": expected_selection["keywords"],
    }
    assert len(captured["yahoo_keywords"]) == 150
    assert result["status"] == "partial_success"
    output = capsys.readouterr().out
    assert "Yahoo keyword selection:" in output
    assert "latest_trade_date=2026-07-15" in output
    assert "total_crop_count=200" in output
    assert "fixed_count=50" in output
    assert "rotating_count=100" in output
    assert "selected_count=150" in output
    assert "rotation_batch=" in output


def test_determine_status_success_requires_all_five_sources_and_no_parse_issues():
    articles = [
        {**make_article(source_name="農業部", key="moa"), "crawl_source": "moa"},
        {**make_article(source_name="農糧署", key="afa"), "crawl_source": "afa"},
        {**make_article(source_name="PTT Fruits", key="ptt"), "crawl_source": "ptt_fruits"},
        {**make_article(source_name="農傳媒", key="agriharvest"), "crawl_source": "agriharvest"},
        {**make_article(source_name="自由時報", key="yahoo"), "crawl_source": "yahoo"},
    ]

    assert script.determine_status(articles, {"parse_issue_count": 0}) == "success"
    assert script.determine_status(articles[:-1], {"parse_issue_count": 0}) == "partial_success"
    assert script.determine_status(articles, {"parse_issue_count": 1}) == "partial_success"
