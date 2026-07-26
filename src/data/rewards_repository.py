"""會員點數、優惠券與兌換紀錄的 PostgreSQL 存取層。"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from src.data.price_repository import _load_database_url

LOGIN_REWARD_POINTS = int(os.getenv("SMARTBUY_LOGIN_REWARD_POINTS", "10"))
RECOMMENDATION_REWARD_POINTS = int(os.getenv("SMARTBUY_RECOMMENDATION_REWARD_POINTS", "20"))
TAIPEI = ZoneInfo("Asia/Taipei")


def _get_engine():
    db_url = _load_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL 未設定，無法連線至資料庫。")
    return create_engine(db_url, pool_pre_ping=True)


def _now_local_date() -> str:
    return datetime.now(TAIPEI).date().isoformat()


def _account_row(conn, member_id: int):
    conn.execute(
        text(
            """
            INSERT INTO member_points_accounts (member_id)
            VALUES (:member_id)
            ON CONFLICT (member_id) DO NOTHING;
            """
        ),
        {"member_id": member_id},
    )
    return conn.execute(
        text("SELECT * FROM member_points_accounts WHERE member_id = :member_id FOR UPDATE;"),
        {"member_id": member_id},
    ).mappings().one()


def grant_points(
    member_id: int,
    amount: int,
    reason: str,
    reference_type: str,
    reference_id: str,
    idempotency_key: str,
) -> dict:
    """以冪等 key 發放點數；重試不會重複增加餘額。"""
    if amount <= 0:
        raise ValueError("獎勵點數必須大於 0。")

    engine = _get_engine()
    with engine.begin() as conn:
        _account_row(conn, member_id)
        inserted = conn.execute(
            text(
                """
                INSERT INTO member_point_transactions
                    (member_id, amount, reason, reference_type, reference_id, idempotency_key)
                VALUES (:member_id, :amount, :reason, :reference_type, :reference_id, :idempotency_key)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id;
                """
            ),
            {
                "member_id": member_id,
                "amount": amount,
                "reason": reason,
                "reference_type": reference_type,
                "reference_id": str(reference_id),
                "idempotency_key": idempotency_key,
            },
        ).mappings().first()
        if inserted:
            conn.execute(
                text(
                    """
                    UPDATE member_points_accounts
                    SET balance = balance + :amount,
                        lifetime_earned = lifetime_earned + :amount,
                        updated_at = NOW()
                    WHERE member_id = :member_id;
                    """
                ),
                {"member_id": member_id, "amount": amount},
            )
            awarded = True
        else:
            awarded = False

        account = conn.execute(
            text("SELECT balance FROM member_points_accounts WHERE member_id = :member_id;"),
            {"member_id": member_id},
        ).mappings().one()

    return {"awarded": awarded, "points": amount if awarded else 0, "balance": account["balance"]}


def grant_login_points(member_id: int) -> dict:
    day = _now_local_date()
    return grant_points(
        member_id=member_id,
        amount=LOGIN_REWARD_POINTS,
        reason="每日登入獎勵",
        reference_type="login",
        reference_id=day,
        idempotency_key=f"login:{member_id}:{day}",
    )


def grant_recommendation_points(member_id: int, post_id: int) -> dict:
    return grant_points(
        member_id=member_id,
        amount=RECOMMENDATION_REWARD_POINTS,
        reason="分享好物推薦",
        reference_type="product_recommendation",
        reference_id=str(post_id),
        idempotency_key=f"recommendation:{post_id}",
    )


def _transaction_response(row) -> dict:
    return {
        "id": row["id"],
        "amount": row["amount"],
        "reason": row["reason"],
        "reference_type": row["reference_type"],
        "reference_id": row["reference_id"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def get_points_summary(member_id: int, transaction_limit: int = 20) -> dict:
    engine = _get_engine()
    with engine.begin() as conn:
        account = _account_row(conn, member_id)
        rows = conn.execute(
            text(
                """
                SELECT id, amount, reason, reference_type, reference_id, created_at
                FROM member_point_transactions
                WHERE member_id = :member_id
                ORDER BY created_at DESC
                LIMIT :limit;
                """
            ),
            {"member_id": member_id, "limit": transaction_limit},
        ).mappings().all()
    return {
        "balance": account["balance"],
        "lifetime_earned": account["lifetime_earned"],
        "lifetime_spent": account["lifetime_spent"],
        "transactions": [_transaction_response(row) for row in rows],
    }


def _coupon_response(row, owned: bool | None = None) -> dict:
    result = {
        "id": row["id"],
        "code": row["code"],
        "title": row["title"],
        "description": row["description"],
        "points_cost": row["points_cost"],
        "discount_type": row["discount_type"],
        "discount_value": float(row["discount_value"]),
        "starts_at": row["starts_at"].isoformat() if row["starts_at"] else None,
        "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        "stock": row["stock"],
        "redeemed_count": row["redeemed_count"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if owned is not None:
        result["owned"] = owned
    if "redemption_code" in row:
        result["redemption_code"] = row["redemption_code"]
        result["member_coupon_status"] = row["member_coupon_status"]
        result["redeemed_at"] = row["redeemed_at"].isoformat() if row["redeemed_at"] else None
    return result


def list_available_coupons(member_id: int | None = None) -> list[dict]:
    engine = _get_engine()
    ownership = "FALSE AS owned"
    join = ""
    params = {}
    if member_id is not None:
        ownership = "(mc.id IS NOT NULL) AS owned"
        join = "LEFT JOIN member_coupons mc ON mc.coupon_id = c.id AND mc.member_id = :member_id"
        params["member_id"] = member_id
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT c.*, {ownership}
                FROM coupons c
                {join}
                WHERE c.status = 'active'
                  AND c.starts_at <= NOW()
                  AND (c.expires_at IS NULL OR c.expires_at > NOW())
                  AND (c.stock IS NULL OR c.redeemed_count < c.stock)
                ORDER BY c.points_cost ASC, c.expires_at NULLS LAST, c.created_at DESC;
                """
            ),
            params,
        ).mappings().all()
    return [_coupon_response(row, owned=bool(row["owned"])) for row in rows]


def _new_redemption_code(conn) -> str:
    for _ in range(5):
        code = f"SB-{secrets.token_hex(5).upper()}"
        if not conn.execute(text("SELECT 1 FROM member_coupons WHERE redemption_code = :code;"), {"code": code}).first():
            return code
    raise RuntimeError("無法產生優惠券兌換碼。")


def redeem_coupon(member_id: int, coupon_id: int) -> dict:
    engine = _get_engine()
    with engine.begin() as conn:
        coupon = conn.execute(
            text("SELECT * FROM coupons WHERE id = :coupon_id FOR UPDATE;"),
            {"coupon_id": coupon_id},
        ).mappings().first()
        if coupon is None:
            raise LookupError("coupon_not_found")
        if coupon["status"] != "active" or coupon["starts_at"] > datetime.now(timezone.utc) or (
            coupon["expires_at"] and coupon["expires_at"] <= datetime.now(timezone.utc)
        ):
            raise ValueError("此優惠券目前無法兌換。")
        if coupon["stock"] is not None and coupon["redeemed_count"] >= coupon["stock"]:
            raise ValueError("此優惠券已兌換完畢。")
        already = conn.execute(
            text("SELECT 1 FROM member_coupons WHERE member_id = :member_id AND coupon_id = :coupon_id;"),
            {"member_id": member_id, "coupon_id": coupon_id},
        ).first()
        if already:
            raise ValueError("你已經兌換過這張優惠券。")

        account = _account_row(conn, member_id)
        if account["balance"] < coupon["points_cost"]:
            raise ValueError("點數不足，還差一些點數才能兌換。")

        idempotency_key = f"redeem:{member_id}:{coupon_id}"
        conn.execute(
            text(
                """
                INSERT INTO member_point_transactions
                    (member_id, amount, reason, reference_type, reference_id, idempotency_key)
                VALUES (:member_id, :amount, '兌換優惠券', 'coupon', :reference_id, :idempotency_key);
                """
            ),
            {
                "member_id": member_id,
                "amount": -coupon["points_cost"],
                "reference_id": str(coupon_id),
                "idempotency_key": idempotency_key,
            },
        )
        conn.execute(
            text(
                """
                UPDATE member_points_accounts
                SET balance = balance - :cost,
                    lifetime_spent = lifetime_spent + :cost,
                    updated_at = NOW()
                WHERE member_id = :member_id;
                """
            ),
            {"member_id": member_id, "cost": coupon["points_cost"]},
        )
        redemption_code = _new_redemption_code(conn)
        member_coupon = conn.execute(
            text(
                """
                INSERT INTO member_coupons (member_id, coupon_id, redemption_code)
                VALUES (:member_id, :coupon_id, :redemption_code)
                RETURNING id, redemption_code, status, redeemed_at;
                """
            ),
            {"member_id": member_id, "coupon_id": coupon_id, "redemption_code": redemption_code},
        ).mappings().one()
        conn.execute(
            text("UPDATE coupons SET redeemed_count = redeemed_count + 1, updated_at = NOW() WHERE id = :coupon_id;"),
            {"coupon_id": coupon_id},
        )
        balance = conn.execute(
            text("SELECT balance FROM member_points_accounts WHERE member_id = :member_id;"),
            {"member_id": member_id},
        ).scalar_one()

    result = _coupon_response(
        {
            **dict(coupon),
            "redemption_code": member_coupon["redemption_code"],
            "member_coupon_status": member_coupon["status"],
            "redeemed_at": member_coupon["redeemed_at"],
        }
    )
    result["balance"] = balance
    return result


def list_member_coupons(member_id: int) -> list[dict]:
    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT c.*, mc.redemption_code, mc.status AS member_coupon_status, mc.redeemed_at
                FROM member_coupons mc
                JOIN coupons c ON c.id = mc.coupon_id
                WHERE mc.member_id = :member_id
                ORDER BY mc.created_at DESC;
                """
            ),
            {"member_id": member_id},
        ).mappings().all()
    return [_coupon_response(row) for row in rows]


def list_coupons_for_admin() -> list[dict]:
    engine = _get_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT * FROM coupons ORDER BY created_at DESC;")).mappings().all()
    return [_coupon_response(row) for row in rows]


def create_coupon(**values) -> dict:
    _validate_coupon_values(values)
    values["code"] = values["code"].strip().upper()
    values["starts_at"] = values.get("starts_at") or datetime.now(timezone.utc)
    engine = _get_engine()
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO coupons
                    (code, title, description, points_cost, discount_type, discount_value,
                     starts_at, expires_at, stock, status)
                VALUES (:code, :title, :description, :points_cost, :discount_type, :discount_value,
                        :starts_at, :expires_at, :stock, :status)
                RETURNING *;
                """
            ), values,
        ).mappings().one()
    return _coupon_response(row)


def update_coupon(coupon_id: int, patch: dict) -> dict:
    patch = {key: value for key, value in patch.items() if value is not None}
    if "code" in patch:
        patch["code"] = patch["code"].strip().upper()
    _validate_coupon_values(patch, partial=True)
    if not patch:
        raise ValueError("未提供任何更新欄位。")
    engine = _get_engine()
    with engine.begin() as conn:
        if not conn.execute(text("SELECT 1 FROM coupons WHERE id = :coupon_id;"), {"coupon_id": coupon_id}).first():
            raise LookupError("coupon_not_found")
        set_parts = [f"{field} = :{field}" for field in patch]
        row = conn.execute(
            text(f"UPDATE coupons SET {', '.join(set_parts)}, updated_at = NOW() WHERE id = :coupon_id RETURNING *;"),
            {**patch, "coupon_id": coupon_id},
        ).mappings().one()
    return _coupon_response(row)


def _validate_coupon_values(values: dict, partial: bool = False) -> None:
    if not partial or "code" in values:
        if not values.get("code") or len(values["code"].strip()) < 2:
            raise ValueError("優惠券代碼至少需要 2 個字元。")
    if not partial or "title" in values:
        if not values.get("title") or not values["title"].strip():
            raise ValueError("優惠券名稱不可空白。")
    for key in ("points_cost", "discount_value"):
        if key in values and values[key] <= 0:
            raise ValueError(f"{key} 必須大於 0。")
    if "discount_type" in values and values["discount_type"] not in {"fixed", "percent"}:
        raise ValueError("折扣類型不正確。")
    if values.get("discount_type") == "percent" and values.get("discount_value", 0) > 100:
        raise ValueError("百分比折扣不可超過 100。")
    if values.get("expires_at") and values.get("starts_at") and values["expires_at"] <= values["starts_at"]:
        raise ValueError("結束時間必須晚於開始時間。")
