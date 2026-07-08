-- 建立 members 資料表
-- 用於儲存會員帳號資訊（電子郵件、密碼、姓名）
-- plan 欄位僅在會員升級時由後端更新，不出現在前端申請表單中
--
-- 【相關元件 (Related Components)】
-- - 前端登入：frontend/src/context/AuthContext.jsx
-- - 前端設定頁：frontend/src/pages/Settings.jsx
-- - 後端 API：backend/main.py（/api/auth/register、/api/auth/login、/api/auth/me、/api/auth/profile）

CREATE TABLE IF NOT EXISTS members (
    id           SERIAL PRIMARY KEY,
    email        VARCHAR(100)  NOT NULL UNIQUE,     -- 登入帳號，必填，全局唯一
    password_hash VARCHAR(255) NOT NULL,             -- bcrypt 雜湊後的密碼，必填
    name         VARCHAR(100)  NOT NULL,             -- 顯示名稱，必填

    -- plan 欄位：不出現在會員申請表單；
    -- 預設為「免費會員」，僅在管理後台或升級流程中透過 UPDATE 變更。
    plan         VARCHAR(50)   NOT NULL DEFAULT '免費會員',

    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── 索引：加速 Email 登入查詢 ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_email ON members (email);

-- ── Trigger：自動更新 updated_at ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
