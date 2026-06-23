-- 建立 price_reports 資料表
-- 用於儲存使用者買貴通報，提供後續管理與對比分析

CREATE TABLE IF NOT EXISTS price_reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(50) NOT NULL UNIQUE,
    report_date DATE NOT NULL,
    crop_name VARCHAR(100),
    product_name VARCHAR(100) NOT NULL,
    market_name VARCHAR(100) NOT NULL,
    user_price NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT '元/公斤' NOT NULL,
    reference_price NUMERIC(10, 2) DEFAULT NULL,
    price_gap NUMERIC(10, 2) DEFAULT NULL,
    price_gap_percent NUMERIC(10, 4) DEFAULT NULL,
    report_note VARCHAR(255) DEFAULT '待確認',
    write_destination VARCHAR(50) NOT NULL, -- 'Supabase' 或 '本機 CSV'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_price_reports_date ON price_reports (report_date);
CREATE INDEX IF NOT EXISTS idx_price_reports_product ON price_reports (product_name);
