-- DEPRECATED: 建立舊版 prediction_results 資料表
-- 僅供封存的五日數值 Baseline 預測流程使用。
-- 此表已退出 SmartBuy AI 正式 MVP 預測範圍；目前前台與每日排程不得依賴此表。
-- 正式 MVP 預測結果表為 public.price_direction_predictions。

CREATE TABLE IF NOT EXISTS prediction_results (
    id SERIAL PRIMARY KEY,
    predict_date DATE NOT NULL,
    crop_code VARCHAR(50) NOT NULL,
    crop_name VARCHAR(100),
    market_code VARCHAR(50) NOT NULL,
    market_name VARCHAR(100),
    predicted_price NUMERIC,
    predicted_status VARCHAR(50), -- e.g., 'normal' (正常), 'expensive' (偏貴), 'cheap' (便宜)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (predict_date, crop_code, market_code)
);

-- 建立索引以優化查詢效能
CREATE INDEX IF NOT EXISTS idx_prediction_results_date ON prediction_results (predict_date);
CREATE INDEX IF NOT EXISTS idx_prediction_results_crop ON prediction_results (crop_code);
