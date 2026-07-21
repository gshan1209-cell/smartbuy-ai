from __future__ import annotations

import os
import sys
import types
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from src.data import favorites_repository


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
        pytest.skip("DATABASE_URL is required for user_favorites Phase 1 tests.")
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
    monkeypatch.setattr(
        favorites_repository,
        "_get_engine",
        lambda: _TransactionalEngine(db_conn),
    )
    return db_conn


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


def _create_member(conn) -> int:
    row = conn.execute(
        text(
            """
            INSERT INTO public.members (email, password_hash, name)
            VALUES (:email, 'phase1-test-hash', 'Phase 1 Test')
            RETURNING id;
            """
        ),
        {"email": f"{_unique('favorite')}@example.test"},
    ).first()
    return row[0]


def _create_news_article(conn) -> int:
    token = _unique("article")
    row = conn.execute(
        text(
            """
            INSERT INTO public.agri_news_articles (
                article_key,
                source_name,
                title,
                source_url,
                parse_status
            )
            VALUES (
                :article_key,
                'pytest',
                'Phase 1 favorite test article',
                :source_url,
                'success'
            )
            RETURNING id;
            """
        ),
        {
            "article_key": token,
            "source_url": f"https://example.test/{token}",
        },
    ).first()
    return row[0]


def _favorite_count(conn, **where) -> int:
    clauses = []
    params = {}
    for key, value in where.items():
        clauses.append(f"{key} = :{key}")
        params[key] = value
    sql = "SELECT COUNT(*) FROM public.user_favorites"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    return conn.execute(text(sql), params).scalar_one()


def test_news_favorite_succeeds_and_maps_to_article_id(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)

    favorites_repository.add_favorite(
        member_id,
        "news",
        str(news_article_id),
        {"title": "saved news"},
    )

    row = repository_conn.execute(
        text(
            """
            SELECT ref_id, news_article_id, product_crop_code
            FROM public.user_favorites
            WHERE member_id = :member_id AND type = 'news';
            """
        ),
        {"member_id": member_id},
    ).mappings().one()
    assert row["ref_id"] == str(news_article_id)
    assert row["news_article_id"] == news_article_id
    assert row["product_crop_code"] is None


def test_nonexistent_news_id_is_blocked_by_fk(repository_conn):
    member_id = _create_member(repository_conn)
    missing_id = repository_conn.execute(
        text("SELECT COALESCE(MAX(id), 0) + 1000000 FROM public.agri_news_articles;")
    ).scalar_one()

    with pytest.raises(IntegrityError):
        favorites_repository.add_favorite(member_id, "news", str(missing_id), {})


def test_non_integer_news_ref_id_is_rejected(repository_conn):
    member_id = _create_member(repository_conn)

    with pytest.raises(ValueError, match="正整數"):
        favorites_repository.add_favorite(member_id, "news", "abc", {})


def test_product_favorite_succeeds_and_trims_code(repository_conn):
    member_id = _create_member(repository_conn)

    favorites_repository.add_favorite(member_id, "product", " A001 ", {})

    row = repository_conn.execute(
        text(
            """
            SELECT ref_id, news_article_id, product_crop_code
            FROM public.user_favorites
            WHERE member_id = :member_id AND type = 'product';
            """
        ),
        {"member_id": member_id},
    ).mappings().one()
    assert row["ref_id"] == "A001"
    assert row["news_article_id"] is None
    assert row["product_crop_code"] == "A001"


def test_blank_product_code_is_rejected(repository_conn):
    member_id = _create_member(repository_conn)

    with pytest.raises(ValueError, match="不可空白"):
        favorites_repository.add_favorite(member_id, "product", "   ", {})


def test_duplicate_news_favorite_does_not_insert_second_row(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)

    favorites_repository.add_favorite(member_id, "news", str(news_article_id), {})
    favorites_repository.add_favorite(member_id, "news", str(news_article_id), {})

    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="news",
        news_article_id=news_article_id,
    ) == 1


def test_duplicate_product_favorite_does_not_insert_second_row(repository_conn):
    member_id = _create_member(repository_conn)

    favorites_repository.add_favorite(member_id, "product", " B002 ", {})
    favorites_repository.add_favorite(member_id, "product", "B002", {})

    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="product",
        product_crop_code="B002",
    ) == 1


def test_different_members_can_favorite_same_news(repository_conn):
    first_member_id = _create_member(repository_conn)
    second_member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)

    favorites_repository.add_favorite(first_member_id, "news", str(news_article_id), {})
    favorites_repository.add_favorite(second_member_id, "news", str(news_article_id), {})

    assert _favorite_count(
        repository_conn,
        type="news",
        news_article_id=news_article_id,
    ) == 2


def test_different_members_can_favorite_same_product(repository_conn):
    first_member_id = _create_member(repository_conn)
    second_member_id = _create_member(repository_conn)

    favorites_repository.add_favorite(first_member_id, "product", "C003", {})
    favorites_repository.add_favorite(second_member_id, "product", "C003", {})

    assert _favorite_count(
        repository_conn,
        type="product",
        product_crop_code="C003",
    ) == 2


def test_list_favorites_returns_external_ref_id(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)

    favorites_repository.add_favorite(member_id, "news", str(news_article_id), {})
    favorites_repository.add_favorite(member_id, "product", "D004", {})

    news_rows = favorites_repository.list_favorites(member_id, "news")
    product_rows = favorites_repository.list_favorites(member_id, "product")

    assert news_rows[0]["ref_id"] == str(news_article_id)
    assert product_rows[0]["ref_id"] == "D004"


def test_remove_news_favorite_succeeds(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)
    favorites_repository.add_favorite(member_id, "news", str(news_article_id), {})

    favorites_repository.remove_favorite(member_id, "news", str(news_article_id))

    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="news",
        news_article_id=news_article_id,
    ) == 0


def test_remove_product_favorite_succeeds(repository_conn):
    member_id = _create_member(repository_conn)
    favorites_repository.add_favorite(member_id, "product", "E005", {})

    favorites_repository.remove_favorite(member_id, "product", " E005 ")

    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="product",
        product_crop_code="E005",
    ) == 0


def test_delete_article_cascades_to_news_favorite_only(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)
    favorites_repository.add_favorite(member_id, "news", str(news_article_id), {})
    favorites_repository.add_favorite(member_id, "product", "F006", {})

    deleted_news = repository_conn.execute(
        text(
            """
            DELETE FROM public.agri_news_articles
            WHERE id = :news_article_id
            RETURNING id;
            """
        ),
        {"news_article_id": news_article_id},
    ).scalar_one()

    assert deleted_news == news_article_id
    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="news",
        news_article_id=news_article_id,
    ) == 0
    assert _favorite_count(
        repository_conn,
        member_id=member_id,
        type="product",
        product_crop_code="F006",
    ) == 1


def test_legacy_insert_type_ref_id_is_synced_by_trigger(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)

    repository_conn.execute(
        text(
            """
            INSERT INTO public.user_favorites (member_id, type, ref_id, meta)
            VALUES (:member_id, 'news', :ref_id, '{}'::jsonb);
            """
        ),
        {"member_id": member_id, "ref_id": str(news_article_id)},
    )
    repository_conn.execute(
        text(
            """
            INSERT INTO public.user_favorites (member_id, type, ref_id, meta)
            VALUES (:member_id, 'product', ' G007 ', '{}'::jsonb);
            """
        ),
        {"member_id": member_id},
    )

    rows = repository_conn.execute(
        text(
            """
            SELECT type, ref_id, news_article_id, product_crop_code
            FROM public.user_favorites
            WHERE member_id = :member_id
            ORDER BY type;
            """
        ),
        {"member_id": member_id},
    ).mappings().all()
    assert rows[0]["type"] == "news"
    assert rows[0]["ref_id"] == str(news_article_id)
    assert rows[0]["news_article_id"] == news_article_id
    assert rows[0]["product_crop_code"] is None
    assert rows[1]["type"] == "product"
    assert rows[1]["ref_id"] == "G007"
    assert rows[1]["news_article_id"] is None
    assert rows[1]["product_crop_code"] == "G007"


def test_check_disallows_news_with_product_crop_code(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)
    repository_conn.execute(
        text("ALTER TABLE public.user_favorites DISABLE TRIGGER trg_user_favorites_sync_reference;")
    )

    with pytest.raises(IntegrityError):
        with repository_conn.begin_nested():
            repository_conn.execute(
                text(
                    """
                    INSERT INTO public.user_favorites (
                        member_id,
                        type,
                        ref_id,
                        news_article_id,
                        product_crop_code,
                        meta
                    )
                    VALUES (
                        :member_id,
                        'news',
                        :ref_id,
                        :news_article_id,
                        'H008',
                        '{}'::jsonb
                    );
                    """
                ),
                {
                    "member_id": member_id,
                    "ref_id": str(news_article_id),
                    "news_article_id": news_article_id,
                },
            )


def test_check_disallows_product_with_news_article_id(repository_conn):
    member_id = _create_member(repository_conn)
    news_article_id = _create_news_article(repository_conn)
    repository_conn.execute(
        text("ALTER TABLE public.user_favorites DISABLE TRIGGER trg_user_favorites_sync_reference;")
    )

    with pytest.raises(IntegrityError):
        with repository_conn.begin_nested():
            repository_conn.execute(
                text(
                    """
                    INSERT INTO public.user_favorites (
                        member_id,
                        type,
                        ref_id,
                        news_article_id,
                        product_crop_code,
                        meta
                    )
                    VALUES (
                        :member_id,
                        'product',
                        'I009',
                        :news_article_id,
                        'I009',
                        '{}'::jsonb
                    );
                    """
                ),
                {
                    "member_id": member_id,
                    "news_article_id": news_article_id,
                },
            )


def test_favorites_api_returns_400_for_invalid_ref_ids(monkeypatch):
    fake_auth = types.ModuleType("backend.routers.auth")
    fake_auth._get_current_member_id = lambda: 1
    monkeypatch.setitem(sys.modules, "backend.routers.auth", fake_auth)
    sys.modules.pop("backend.routers.favorites", None)

    import backend.routers.favorites as favorites_router

    app = FastAPI()
    app.include_router(favorites_router.router)
    client = TestClient(app)

    response = client.post("/api/favorites", json={"type": "news", "ref_id": "abc", "meta": {}})
    assert response.status_code == 400

    response = client.post("/api/favorites", json={"type": "product", "ref_id": "   ", "meta": {}})
    assert response.status_code == 400

    response = client.delete("/api/favorites/news/abc")
    assert response.status_code == 400
