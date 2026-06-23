-- 建立 prediction_results 資料表
-- 用於寫回機器學習預測結果，提供前台查詢與展示

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
