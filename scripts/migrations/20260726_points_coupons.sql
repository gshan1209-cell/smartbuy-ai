-- SmartBuy AI 點數、優惠券與兌換紀錄
-- SmartBuy 的 members.id 為 integer；會員外鍵維持相同型別，確保 migration 可建立 FK。

CREATE TABLE IF NOT EXISTS member_points_accounts (
    member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_spent INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_point_transactions (
    id BIGSERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    reason TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS member_point_transactions_member_created_idx
    ON member_point_transactions (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    stock INTEGER CHECK (stock IS NULL OR stock > 0),
    redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coupons_expiry_after_start CHECK (expires_at IS NULL OR expires_at > starts_at),
    CONSTRAINT coupons_stock_not_exceeded CHECK (stock IS NULL OR redeemed_count <= stock)
);

CREATE INDEX IF NOT EXISTS coupons_status_dates_idx
    ON coupons (status, starts_at, expires_at);

CREATE TABLE IF NOT EXISTS member_coupons (
    id BIGSERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    redemption_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (member_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS member_coupons_member_status_idx
    ON member_coupons (member_id, status, created_at DESC);
