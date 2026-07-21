from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from src.data import member_repository


class _ConnectionContext:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, exc_type, exc, traceback):
        return False


class _TransactionalEngine:
    def __init__(self, conn):
        self.conn = conn

    def connect(self):
        return _ConnectionContext(self.conn)

    def begin(self):
        return _ConnectionContext(self.conn)


@pytest.fixture(scope="session")
def db_engine():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required for user_preferences one-to-one tests.")
    return create_engine(database_url, pool_pre_ping=True)


@pytest.fixture
def db_conn(db_engine):
    with db_engine.connect() as conn:
        transaction = conn.begin()
        try:
            yield conn
        finally:
            transaction.rollback()


@pytest.fixture
def repository_conn(db_conn, monkeypatch):
    monkeypatch.setattr(member_repository, "_get_engine", lambda: _TransactionalEngine(db_conn))
    return db_conn


def _unique_email() -> str:
    return f"prefs-{uuid4().hex}@example.test"


def _create_member(conn) -> int:
    row = conn.execute(
        text(
            """
            INSERT INTO public.members (email, password_hash, name)
            VALUES (:email, 'one-to-one-test-hash', 'One To One Test')
            RETURNING id;
            """
        ),
        {"email": _unique_email()},
    ).first()
    return row[0]


def _preferences_row(conn, member_id: int):
    return conn.execute(
        text(
            """
            SELECT member_id, price_alert, weather_alert, mutual_aid_reply,
                   font_size, layout_mode, theme
            FROM public.user_preferences
            WHERE member_id = :member_id;
            """
        ),
        {"member_id": member_id},
    ).mappings().first()


def test_all_current_members_have_exactly_one_preferences_row(db_conn):
    missing = db_conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM public.members m
            LEFT JOIN public.user_preferences p ON p.member_id = m.id
            WHERE p.member_id IS NULL;
            """
        )
    ).scalar_one()
    orphans = db_conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM public.user_preferences p
            LEFT JOIN public.members m ON m.id = p.member_id
            WHERE m.id IS NULL;
            """
        )
    ).scalar_one()
    duplicate_groups = db_conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM (
                SELECT member_id
                FROM public.user_preferences
                GROUP BY member_id
                HAVING COUNT(*) > 1
            ) duplicated;
            """
        )
    ).scalar_one()

    assert missing == 0
    assert orphans == 0
    assert duplicate_groups == 0


def test_inserting_member_creates_default_preferences(db_conn):
    member_id = _create_member(db_conn)

    row = _preferences_row(db_conn, member_id)

    assert row is not None
    assert row["price_alert"] is True
    assert row["weather_alert"] is True
    assert row["mutual_aid_reply"] is False
    assert row["font_size"] == "md"
    assert row["layout_mode"] == "simple"
    assert row["theme"] == "light"


def test_second_preferences_row_is_blocked_by_primary_key(db_conn):
    member_id = _create_member(db_conn)

    with pytest.raises(IntegrityError):
        with db_conn.begin_nested():
            db_conn.execute(
                text(
                    """
                    INSERT INTO public.user_preferences (member_id)
                    VALUES (:member_id);
                    """
                ),
                {"member_id": member_id},
            )


def test_deleting_preferences_without_deleting_member_is_blocked(db_conn):
    member_id = _create_member(db_conn)

    with pytest.raises(IntegrityError):
        with db_conn.begin_nested():
            db_conn.execute(
                text("DELETE FROM public.user_preferences WHERE member_id = :member_id;"),
                {"member_id": member_id},
            )
            db_conn.execute(text("SET CONSTRAINTS trg_user_preferences_require_member_pair IMMEDIATE;"))


def test_deleting_member_cascades_preferences_without_blocking(db_conn):
    member_id = _create_member(db_conn)
    assert _preferences_row(db_conn, member_id) is not None

    deleted_id = db_conn.execute(
        text("DELETE FROM public.members WHERE id = :member_id RETURNING id;"),
        {"member_id": member_id},
    ).scalar_one()
    db_conn.execute(text("SET CONSTRAINTS trg_user_preferences_require_member_pair IMMEDIATE;"))

    member_count = db_conn.execute(
        text("SELECT COUNT(*) FROM public.members WHERE id = :member_id;"),
        {"member_id": member_id},
    ).scalar_one()
    pref_count = db_conn.execute(
        text("SELECT COUNT(*) FROM public.user_preferences WHERE member_id = :member_id;"),
        {"member_id": member_id},
    ).scalar_one()
    assert deleted_id == member_id
    assert member_count == 0
    assert pref_count == 0


def test_existing_preferences_are_not_overwritten_by_backfill_insert(db_conn):
    member_id = _create_member(db_conn)
    db_conn.execute(
        text(
            """
            UPDATE public.user_preferences
            SET price_alert = FALSE,
                weather_alert = FALSE,
                mutual_aid_reply = TRUE,
                font_size = 'lg',
                layout_mode = 'detailed',
                theme = 'dark'
            WHERE member_id = :member_id;
            """
        ),
        {"member_id": member_id},
    )

    db_conn.execute(
        text(
            """
            INSERT INTO public.user_preferences (
                member_id,
                price_alert,
                weather_alert,
                mutual_aid_reply,
                font_size,
                layout_mode,
                theme
            )
            SELECT
                members.id,
                TRUE,
                TRUE,
                FALSE,
                'md',
                'simple',
                'light'
            FROM public.members members
            WHERE members.id = :member_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.user_preferences preferences
                  WHERE preferences.member_id = members.id
              );
            """
        ),
        {"member_id": member_id},
    )

    row = _preferences_row(db_conn, member_id)
    assert row["price_alert"] is False
    assert row["weather_alert"] is False
    assert row["mutual_aid_reply"] is True
    assert row["font_size"] == "lg"
    assert row["layout_mode"] == "detailed"
    assert row["theme"] == "dark"


def test_duplicate_member_id_unique_constraint_no_longer_exists(db_conn):
    count = db_conn.execute(
        text(
            """
            SELECT COUNT(*)
            FROM pg_constraint
            WHERE conrelid = 'public.user_preferences'::regclass
              AND conname = 'user_preferences_member_id_unique';
            """
        )
    ).scalar_one()

    assert count == 0


def test_register_member_creates_preferences_and_preferences_can_be_updated(repository_conn):
    result = member_repository.register_member(_unique_email(), "password123", "Preference User")
    member_id = result["member_id"]

    defaults = member_repository.get_preferences(member_id)
    updated = member_repository.update_preferences(
        member_id,
        {
            "priceAlert": False,
            "weatherAlert": False,
            "mutualAidReply": True,
            "fontSize": "lg",
            "layout": "detailed",
            "theme": "dark",
        },
    )

    assert defaults == {
        "priceAlert": True,
        "weatherAlert": True,
        "mutualAidReply": False,
        "fontSize": "md",
        "layout": "simple",
        "theme": "light",
    }
    assert updated == {
        "priceAlert": False,
        "weatherAlert": False,
        "mutualAidReply": True,
        "fontSize": "lg",
        "layout": "detailed",
        "theme": "dark",
    }
