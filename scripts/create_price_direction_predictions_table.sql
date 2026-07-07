-- 建立 price_direction_predictions 資料表
-- 用於儲存每日 LightGBM 價格方向模型輸出，提供前端查詢下一交易日方向、信心與風險提醒。

CREATE TABLE IF NOT EXISTS public.price_direction_predictions (
    upsert_key TEXT PRIMARY KEY,
    market_id TEXT NOT NULL,
    market_name TEXT,
    crop_id TEXT NOT NULL,
    crop_name TEXT,
    base_date DATE NOT NULL,
    global_latest_trade_date DATE NOT NULL,
    data_staleness_days INTEGER NOT NULL CHECK (data_staleness_days BETWEEN 0 AND 7),
    prediction_target TEXT NOT NULL,
    pred_label_direction INTEGER NOT NULL CHECK (pred_label_direction IN (-1, 0, 1)),
    pred_label_name TEXT NOT NULL CHECK (pred_label_name IN ('跌', '持平', '漲')),
    prob_down DOUBLE PRECISION NOT NULL CHECK (prob_down >= 0 AND prob_down <= 1),
    prob_flat DOUBLE PRECISION NOT NULL CHECK (prob_flat >= 0 AND prob_flat <= 1),
    prob_up DOUBLE PRECISION NOT NULL CHECK (prob_up >= 0 AND prob_up <= 1),
    pred_confidence DOUBLE PRECISION NOT NULL CHECK (pred_confidence >= 0 AND pred_confidence <= 1),
    confidence_level TEXT NOT NULL CHECK (confidence_level IN ('低', '中', '高')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('normal', 'medium', 'high')),
    risk_note TEXT,
    display_message TEXT NOT NULL,
    model_type TEXT NOT NULL,
    payload_version TEXT NOT NULL,
    created_by_stage TEXT NOT NULL,
    prepared_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_market_crop
    ON public.price_direction_predictions (market_id, crop_id);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_base_date
    ON public.price_direction_predictions (base_date DESC);

CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_direction
    ON public.price_direction_predictions (pred_label_direction);

-- 若前端要用 anon key 直接查詢此表，請先確認資料不含敏感欄位，再建立只讀 RLS policy。
-- 若只由後端 API 查詢，可維持不開放匿名直接讀取。
