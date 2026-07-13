-- 建立 agri_price_features_daily 特徵資料表與 Supabase Data API 讀取介面。
-- 來源資料表：public.agri_price_daily
-- 欄位對應：
--   trade_date  <- trans_date
--   market_id   <- market_code
--   market_name <- market_name
--   crop_id     <- crop_code
--   crop_name   <- crop_name
--
-- 部署方式：在 Supabase SQL Editor 執行本檔，之後每日更新程式會呼叫
-- public.refresh_agri_price_features() 重新產製特徵。

CREATE TABLE IF NOT EXISTS public.agri_price_features_daily (
    trade_date DATE NOT NULL,
    market_id TEXT NOT NULL,
    market_name TEXT,
    crop_id TEXT NOT NULL,
    crop_name TEXT,

    avg_price DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL,

    price_lag_1 DOUBLE PRECISION,
    price_lag_3 DOUBLE PRECISION,
    price_lag_7 DOUBLE PRECISION,
    price_lag_14 DOUBLE PRECISION,

    volume_lag_1 DOUBLE PRECISION,
    volume_lag_3 DOUBLE PRECISION,
    volume_lag_7 DOUBLE PRECISION,
    volume_lag_14 DOUBLE PRECISION,

    price_return_1 DOUBLE PRECISION,
    price_return_3 DOUBLE PRECISION,
    price_return_7 DOUBLE PRECISION,
    price_return_14 DOUBLE PRECISION,

    volume_change_1 DOUBLE PRECISION,
    volume_change_7 DOUBLE PRECISION,

    price_ma_7 DOUBLE PRECISION,
    price_ma_14 DOUBLE PRECISION,

    volume_ma_7 DOUBLE PRECISION,
    volume_ma_14 DOUBLE PRECISION,

    price_std_7 DOUBLE PRECISION,
    price_std_14 DOUBLE PRECISION,

    price_vs_ma_7 DOUBLE PRECISION,
    volume_vs_ma_7 DOUBLE PRECISION,

    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),

    history_sequence_no INTEGER NOT NULL CHECK (history_sequence_no >= 1),
    is_feature_complete BOOLEAN NOT NULL,
    feature_version TEXT NOT NULL DEFAULT 'v1_no_month_cycle',
    feature_computed_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (trade_date, market_id, crop_id)
);

CREATE INDEX IF NOT EXISTS idx_agri_price_features_daily_market_crop_date_desc
    ON public.agri_price_features_daily (market_id, crop_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_agri_price_daily_feature_source_order
    ON public.agri_price_daily (market_code, crop_code, trans_date)
    WHERE trans_date IS NOT NULL
      AND market_code IS NOT NULL
      AND crop_code IS NOT NULL
      AND avg_price > 0
      AND volume > 0;

ALTER TABLE public.agri_price_features_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.refresh_agri_price_features()
RETURNS TABLE (
    upserted_rows INTEGER,
    deleted_stale_rows INTEGER,
    feature_computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '10min'
AS $$
DECLARE
    v_duplicate_count INTEGER;
    v_upserted_rows INTEGER := 0;
    v_deleted_rows INTEGER := 0;
    v_computed_at TIMESTAMPTZ := NOW();
BEGIN
    SELECT COUNT(*)
    INTO v_duplicate_count
    FROM (
        SELECT trans_date, crop_code, market_code
        FROM public.agri_price_daily
        WHERE trans_date IS NOT NULL
          AND crop_code IS NOT NULL
          AND market_code IS NOT NULL
          AND avg_price > 0
          AND volume > 0
        GROUP BY trans_date, crop_code, market_code
        HAVING COUNT(*) > 1
    ) duplicates;

    IF v_duplicate_count > 0 THEN
        RAISE EXCEPTION
            'agri_price_daily has % duplicate valid source keys; stop feature refresh',
            v_duplicate_count;
    END IF;

    WITH valid_source AS (
        SELECT
            trans_date::date AS trade_date,
            market_code::text AS market_id,
            market_name::text AS market_name,
            crop_code::text AS crop_id,
            crop_name::text AS crop_name,
            avg_price::double precision AS avg_price,
            volume::double precision AS volume
        FROM public.agri_price_daily
        WHERE trans_date IS NOT NULL
          AND market_code IS NOT NULL
          AND crop_code IS NOT NULL
          AND avg_price > 0
          AND volume > 0
    ),
    lag_features AS (
        SELECT
            *,
            ROW_NUMBER() OVER pair_window AS history_sequence_no,

            LAG(avg_price, 1)  OVER pair_window AS price_lag_1,
            LAG(avg_price, 3)  OVER pair_window AS price_lag_3,
            LAG(avg_price, 7)  OVER pair_window AS price_lag_7,
            LAG(avg_price, 14) OVER pair_window AS price_lag_14,

            LAG(volume, 1)  OVER pair_window AS volume_lag_1,
            LAG(volume, 3)  OVER pair_window AS volume_lag_3,
            LAG(volume, 7)  OVER pair_window AS volume_lag_7,
            LAG(volume, 14) OVER pair_window AS volume_lag_14
        FROM valid_source
        WINDOW pair_window AS (
            PARTITION BY market_id, crop_id
            ORDER BY trade_date
        )
    ),
    rolling_raw AS (
        SELECT
            *,

            COUNT(avg_price) OVER window_7 AS price_count_7,
            COUNT(avg_price) OVER window_14 AS price_count_14,
            COUNT(volume) OVER window_7 AS volume_count_7,
            COUNT(volume) OVER window_14 AS volume_count_14,

            AVG(avg_price) OVER window_7 AS price_ma_7_raw,
            AVG(avg_price) OVER window_14 AS price_ma_14_raw,

            AVG(volume) OVER window_7 AS volume_ma_7_raw,
            AVG(volume) OVER window_14 AS volume_ma_14_raw,

            STDDEV_POP(avg_price) OVER window_7 AS price_std_7_raw,
            STDDEV_POP(avg_price) OVER window_14 AS price_std_14_raw
        FROM lag_features
        WINDOW
            window_7 AS (
                PARTITION BY market_id, crop_id
                ORDER BY trade_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ),
            window_14 AS (
                PARTITION BY market_id, crop_id
                ORDER BY trade_date
                ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
            )
    ),
    rolling_complete AS (
        SELECT
            *,

            CASE WHEN price_count_7 = 7 THEN price_ma_7_raw END AS price_ma_7,
            CASE WHEN price_count_14 = 14 THEN price_ma_14_raw END AS price_ma_14,

            CASE WHEN volume_count_7 = 7 THEN volume_ma_7_raw END AS volume_ma_7,
            CASE WHEN volume_count_14 = 14 THEN volume_ma_14_raw END AS volume_ma_14,

            CASE WHEN price_count_7 = 7 THEN price_std_7_raw END AS price_std_7,
            CASE WHEN price_count_14 = 14 THEN price_std_14_raw END AS price_std_14
        FROM rolling_raw
    ),
    derived_features AS (
        SELECT
            *,

            avg_price / NULLIF(price_lag_1, 0) - 1 AS price_return_1,
            avg_price / NULLIF(price_lag_3, 0) - 1 AS price_return_3,
            avg_price / NULLIF(price_lag_7, 0) - 1 AS price_return_7,
            avg_price / NULLIF(price_lag_14, 0) - 1 AS price_return_14,

            volume / NULLIF(volume_lag_1, 0) - 1 AS volume_change_1,
            volume / NULLIF(volume_lag_7, 0) - 1 AS volume_change_7,

            CASE
                WHEN price_ma_7 > 0
                THEN avg_price / price_ma_7 - 1
            END AS price_vs_ma_7,

            CASE
                WHEN volume_ma_7 > 0
                THEN volume / volume_ma_7 - 1
            END AS volume_vs_ma_7,

            EXTRACT(ISODOW FROM trade_date)::smallint - 1 AS day_of_week,
            EXTRACT(MONTH FROM trade_date)::smallint AS month
        FROM rolling_complete
    ),
    final_feature_rows AS (
        SELECT
            trade_date,
            market_id,
            market_name,
            crop_id,
            crop_name,

            avg_price,
            volume,

            price_lag_1,
            price_lag_3,
            price_lag_7,
            price_lag_14,

            volume_lag_1,
            volume_lag_3,
            volume_lag_7,
            volume_lag_14,

            price_return_1,
            price_return_3,
            price_return_7,
            price_return_14,

            volume_change_1,
            volume_change_7,

            price_ma_7,
            price_ma_14,
            volume_ma_7,
            volume_ma_14,

            price_std_7,
            price_std_14,

            price_vs_ma_7,
            volume_vs_ma_7,

            day_of_week,
            month,

            history_sequence_no::integer AS history_sequence_no,
            (
                market_id IS NOT NULL
                AND crop_id IS NOT NULL
                AND avg_price IS NOT NULL
                AND volume IS NOT NULL
                AND price_lag_1 IS NOT NULL
                AND price_lag_3 IS NOT NULL
                AND price_lag_7 IS NOT NULL
                AND price_lag_14 IS NOT NULL
                AND volume_lag_1 IS NOT NULL
                AND volume_lag_3 IS NOT NULL
                AND volume_lag_7 IS NOT NULL
                AND volume_lag_14 IS NOT NULL
                AND price_return_1 IS NOT NULL
                AND price_return_3 IS NOT NULL
                AND price_return_7 IS NOT NULL
                AND price_return_14 IS NOT NULL
                AND volume_change_1 IS NOT NULL
                AND volume_change_7 IS NOT NULL
                AND price_ma_7 IS NOT NULL
                AND price_ma_14 IS NOT NULL
                AND volume_ma_7 IS NOT NULL
                AND volume_ma_14 IS NOT NULL
                AND price_std_7 IS NOT NULL
                AND price_std_14 IS NOT NULL
                AND price_vs_ma_7 IS NOT NULL
                AND volume_vs_ma_7 IS NOT NULL
                AND day_of_week IS NOT NULL
                AND month IS NOT NULL
            ) AS is_feature_complete,
            'v1_no_month_cycle'::text AS feature_version,
            v_computed_at AS feature_computed_at
        FROM derived_features
    ),
    upserted AS (
        INSERT INTO public.agri_price_features_daily (
            trade_date,
            market_id,
            market_name,
            crop_id,
            crop_name,
            avg_price,
            volume,
            price_lag_1,
            price_lag_3,
            price_lag_7,
            price_lag_14,
            volume_lag_1,
            volume_lag_3,
            volume_lag_7,
            volume_lag_14,
            price_return_1,
            price_return_3,
            price_return_7,
            price_return_14,
            volume_change_1,
            volume_change_7,
            price_ma_7,
            price_ma_14,
            volume_ma_7,
            volume_ma_14,
            price_std_7,
            price_std_14,
            price_vs_ma_7,
            volume_vs_ma_7,
            day_of_week,
            month,
            history_sequence_no,
            is_feature_complete,
            feature_version,
            feature_computed_at
        )
        SELECT
            final_rows.trade_date,
            final_rows.market_id,
            final_rows.market_name,
            final_rows.crop_id,
            final_rows.crop_name,
            final_rows.avg_price,
            final_rows.volume,
            final_rows.price_lag_1,
            final_rows.price_lag_3,
            final_rows.price_lag_7,
            final_rows.price_lag_14,
            final_rows.volume_lag_1,
            final_rows.volume_lag_3,
            final_rows.volume_lag_7,
            final_rows.volume_lag_14,
            final_rows.price_return_1,
            final_rows.price_return_3,
            final_rows.price_return_7,
            final_rows.price_return_14,
            final_rows.volume_change_1,
            final_rows.volume_change_7,
            final_rows.price_ma_7,
            final_rows.price_ma_14,
            final_rows.volume_ma_7,
            final_rows.volume_ma_14,
            final_rows.price_std_7,
            final_rows.price_std_14,
            final_rows.price_vs_ma_7,
            final_rows.volume_vs_ma_7,
            final_rows.day_of_week,
            final_rows.month,
            final_rows.history_sequence_no,
            final_rows.is_feature_complete,
            final_rows.feature_version,
            final_rows.feature_computed_at
        FROM final_feature_rows final_rows
        ON CONFLICT (trade_date, market_id, crop_id)
        DO UPDATE SET
            market_name = EXCLUDED.market_name,
            crop_name = EXCLUDED.crop_name,
            avg_price = EXCLUDED.avg_price,
            volume = EXCLUDED.volume,
            price_lag_1 = EXCLUDED.price_lag_1,
            price_lag_3 = EXCLUDED.price_lag_3,
            price_lag_7 = EXCLUDED.price_lag_7,
            price_lag_14 = EXCLUDED.price_lag_14,
            volume_lag_1 = EXCLUDED.volume_lag_1,
            volume_lag_3 = EXCLUDED.volume_lag_3,
            volume_lag_7 = EXCLUDED.volume_lag_7,
            volume_lag_14 = EXCLUDED.volume_lag_14,
            price_return_1 = EXCLUDED.price_return_1,
            price_return_3 = EXCLUDED.price_return_3,
            price_return_7 = EXCLUDED.price_return_7,
            price_return_14 = EXCLUDED.price_return_14,
            volume_change_1 = EXCLUDED.volume_change_1,
            volume_change_7 = EXCLUDED.volume_change_7,
            price_ma_7 = EXCLUDED.price_ma_7,
            price_ma_14 = EXCLUDED.price_ma_14,
            volume_ma_7 = EXCLUDED.volume_ma_7,
            volume_ma_14 = EXCLUDED.volume_ma_14,
            price_std_7 = EXCLUDED.price_std_7,
            price_std_14 = EXCLUDED.price_std_14,
            price_vs_ma_7 = EXCLUDED.price_vs_ma_7,
            volume_vs_ma_7 = EXCLUDED.volume_vs_ma_7,
            day_of_week = EXCLUDED.day_of_week,
            month = EXCLUDED.month,
            history_sequence_no = EXCLUDED.history_sequence_no,
            is_feature_complete = EXCLUDED.is_feature_complete,
            feature_version = EXCLUDED.feature_version,
            feature_computed_at = EXCLUDED.feature_computed_at
        RETURNING 1
    )
    SELECT COUNT(*)::integer
    INTO v_upserted_rows
    FROM upserted;

    DELETE FROM public.agri_price_features_daily feature_rows
    WHERE feature_rows.trade_date < (
        SELECT MIN(source_rows.trans_date)::date
        FROM public.agri_price_daily source_rows
        WHERE source_rows.trans_date IS NOT NULL
          AND source_rows.market_code IS NOT NULL
          AND source_rows.crop_code IS NOT NULL
          AND source_rows.avg_price > 0
          AND source_rows.volume > 0
    );

    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

    RETURN QUERY
    SELECT v_upserted_rows, v_deleted_rows, v_computed_at;
END;
$$;

CREATE OR REPLACE VIEW public.api_agri_price_features_latest AS
SELECT
    trade_date,
    market_id,
    market_name,
    crop_id,
    crop_name,
    avg_price,
    volume,
    price_lag_1,
    price_lag_3,
    price_lag_7,
    price_lag_14,
    volume_lag_1,
    volume_lag_3,
    volume_lag_7,
    volume_lag_14,
    price_return_1,
    price_return_3,
    price_return_7,
    price_return_14,
    volume_change_1,
    volume_change_7,
    price_ma_7,
    price_ma_14,
    volume_ma_7,
    volume_ma_14,
    price_std_7,
    price_std_14,
    price_vs_ma_7,
    volume_vs_ma_7,
    day_of_week,
    month,
    history_sequence_no,
    is_feature_complete,
    feature_version,
    feature_computed_at
FROM (
    SELECT
        feature_rows.*,
        ROW_NUMBER() OVER (
            PARTITION BY market_id, crop_id
            ORDER BY trade_date DESC
        ) AS latest_rank
    FROM public.agri_price_features_daily feature_rows
) ranked
WHERE latest_rank = 1;

CREATE OR REPLACE FUNCTION public.get_agri_price_feature_history(
    p_market_id TEXT,
    p_crop_id TEXT,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 180
)
RETURNS TABLE (
    trade_date DATE,
    market_id TEXT,
    market_name TEXT,
    crop_id TEXT,
    crop_name TEXT,
    avg_price DOUBLE PRECISION,
    volume DOUBLE PRECISION,
    price_lag_1 DOUBLE PRECISION,
    price_lag_3 DOUBLE PRECISION,
    price_lag_7 DOUBLE PRECISION,
    price_lag_14 DOUBLE PRECISION,
    volume_lag_1 DOUBLE PRECISION,
    volume_lag_3 DOUBLE PRECISION,
    volume_lag_7 DOUBLE PRECISION,
    volume_lag_14 DOUBLE PRECISION,
    price_return_1 DOUBLE PRECISION,
    price_return_3 DOUBLE PRECISION,
    price_return_7 DOUBLE PRECISION,
    price_return_14 DOUBLE PRECISION,
    volume_change_1 DOUBLE PRECISION,
    volume_change_7 DOUBLE PRECISION,
    price_ma_7 DOUBLE PRECISION,
    price_ma_14 DOUBLE PRECISION,
    volume_ma_7 DOUBLE PRECISION,
    volume_ma_14 DOUBLE PRECISION,
    price_std_7 DOUBLE PRECISION,
    price_std_14 DOUBLE PRECISION,
    price_vs_ma_7 DOUBLE PRECISION,
    volume_vs_ma_7 DOUBLE PRECISION,
    day_of_week SMALLINT,
    month SMALLINT,
    history_sequence_no INTEGER,
    is_feature_complete BOOLEAN,
    feature_version TEXT,
    feature_computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    IF NULLIF(BTRIM(p_market_id), '') IS NULL THEN
        RAISE EXCEPTION 'p_market_id is required';
    END IF;

    IF NULLIF(BTRIM(p_crop_id), '') IS NULL THEN
        RAISE EXCEPTION 'p_crop_id is required';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 180), 1), 365);

    RETURN QUERY
    SELECT
        feature_rows.trade_date,
        feature_rows.market_id,
        feature_rows.market_name,
        feature_rows.crop_id,
        feature_rows.crop_name,
        feature_rows.avg_price,
        feature_rows.volume,
        feature_rows.price_lag_1,
        feature_rows.price_lag_3,
        feature_rows.price_lag_7,
        feature_rows.price_lag_14,
        feature_rows.volume_lag_1,
        feature_rows.volume_lag_3,
        feature_rows.volume_lag_7,
        feature_rows.volume_lag_14,
        feature_rows.price_return_1,
        feature_rows.price_return_3,
        feature_rows.price_return_7,
        feature_rows.price_return_14,
        feature_rows.volume_change_1,
        feature_rows.volume_change_7,
        feature_rows.price_ma_7,
        feature_rows.price_ma_14,
        feature_rows.volume_ma_7,
        feature_rows.volume_ma_14,
        feature_rows.price_std_7,
        feature_rows.price_std_14,
        feature_rows.price_vs_ma_7,
        feature_rows.volume_vs_ma_7,
        feature_rows.day_of_week,
        feature_rows.month,
        feature_rows.history_sequence_no,
        feature_rows.is_feature_complete,
        feature_rows.feature_version,
        feature_rows.feature_computed_at
    FROM public.agri_price_features_daily feature_rows
    WHERE feature_rows.market_id = p_market_id
      AND feature_rows.crop_id = p_crop_id
      AND (p_start_date IS NULL OR feature_rows.trade_date >= p_start_date)
      AND (p_end_date IS NULL OR feature_rows.trade_date <= p_end_date)
    ORDER BY feature_rows.trade_date ASC
    LIMIT v_limit;
END;
$$;

REVOKE ALL ON public.agri_price_features_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_agri_price_features_latest TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agri_price_feature_history(TEXT, TEXT, DATE, DATE, INTEGER)
    TO anon, authenticated;

-- refresh function is intended for backend/GitHub Actions DATABASE_URL role only.
REVOKE ALL ON FUNCTION public.refresh_agri_price_features() FROM PUBLIC, anon, authenticated;
