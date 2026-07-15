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
    price_ma_30 DOUBLE PRECISION,

    volume_ma_7 DOUBLE PRECISION,
    volume_ma_14 DOUBLE PRECISION,
    volume_ma_30 DOUBLE PRECISION,

    price_std_7 DOUBLE PRECISION,
    price_std_14 DOUBLE PRECISION,
    price_std_30 DOUBLE PRECISION,
    volume_std_30 DOUBLE PRECISION,

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

ALTER TABLE public.agri_price_features_daily
    ADD COLUMN IF NOT EXISTS price_ma_30 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS price_std_30 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS volume_ma_30 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS volume_std_30 DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_agri_price_features_daily_market_crop_date_desc
    ON public.agri_price_features_daily (market_id, crop_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_agri_price_daily_feature_source_order
    ON public.agri_price_daily (market_code, crop_code, trans_date)
    WHERE trans_date IS NOT NULL
      AND market_code IS NOT NULL
      AND crop_code IS NOT NULL
      AND avg_price > 0
      AND volume > 0;

CREATE INDEX IF NOT EXISTS idx_agri_price_daily_feature_lookup_desc
    ON public.agri_price_daily (market_code, crop_code, trans_date DESC)
    INCLUDE (market_name, crop_name, avg_price, volume)
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
SET statement_timeout = '30min'
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.refresh_agri_price_features(CURRENT_DATE, CURRENT_DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_agri_price_features(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    upserted_rows INTEGER,
    deleted_stale_rows INTEGER,
    feature_computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '30min'
AS $$
DECLARE
    v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE);
    v_end_date DATE := COALESCE(p_end_date, COALESCE(p_start_date, CURRENT_DATE));
    v_duplicate_count INTEGER;
    v_upserted_rows INTEGER := 0;
    v_deleted_rows INTEGER := 0;
    v_pruned_rows INTEGER := 0;
    v_computed_at TIMESTAMPTZ := NOW();
BEGIN
    IF v_start_date > v_end_date THEN
        RAISE EXCEPTION
            'p_start_date (%) must be less than or equal to p_end_date (%)',
            v_start_date,
            v_end_date;
    END IF;

    SELECT COUNT(*)
    INTO v_duplicate_count
    FROM (
        SELECT trans_date, crop_code, market_code
        FROM public.agri_price_daily
        WHERE trans_date BETWEEN v_start_date AND v_end_date
          AND trans_date IS NOT NULL
          AND crop_code IS NOT NULL
          AND market_code IS NOT NULL
          AND avg_price > 0
          AND volume > 0
        GROUP BY trans_date, crop_code, market_code
        HAVING COUNT(*) > 1
    ) duplicates;

    IF v_duplicate_count > 0 THEN
        RAISE EXCEPTION
            'agri_price_daily has % duplicate valid source keys in refresh range %..%; stop feature refresh',
            v_duplicate_count,
            v_start_date,
            v_end_date;
    END IF;

    WITH changed_rows AS (
        SELECT
            trans_date::date AS trade_date,
            market_code::text AS market_id,
            market_name::text AS market_name,
            crop_code::text AS crop_id,
            crop_name::text AS crop_name,
            avg_price::double precision AS avg_price,
            volume::double precision AS volume
        FROM public.agri_price_daily
        WHERE trans_date BETWEEN v_start_date AND v_end_date
          AND trans_date IS NOT NULL
          AND market_code IS NOT NULL
          AND crop_code IS NOT NULL
          AND avg_price > 0
          AND volume > 0
    ),
    future_refresh_rows AS (
        SELECT
            future_rows.trans_date::date AS trade_date,
            future_rows.market_code::text AS market_id,
            future_rows.market_name::text AS market_name,
            future_rows.crop_code::text AS crop_id,
            future_rows.crop_name::text AS crop_name,
            future_rows.avg_price::double precision AS avg_price,
            future_rows.volume::double precision AS volume
        FROM changed_rows changed
        CROSS JOIN LATERAL (
            SELECT
                source_rows.trans_date,
                source_rows.market_code,
                source_rows.market_name,
                source_rows.crop_code,
                source_rows.crop_name,
                source_rows.avg_price,
                source_rows.volume
            FROM public.agri_price_daily source_rows
            WHERE source_rows.market_code = changed.market_id
              AND source_rows.crop_code = changed.crop_id
              AND source_rows.trans_date > changed.trade_date
              AND source_rows.trans_date IS NOT NULL
              AND source_rows.market_code IS NOT NULL
              AND source_rows.crop_code IS NOT NULL
              AND source_rows.avg_price > 0
              AND source_rows.volume > 0
            ORDER BY source_rows.trans_date ASC
            LIMIT 29
        ) future_rows
    ),
    valid_refresh_rows AS (
        SELECT DISTINCT ON (trade_date, market_id, crop_id)
            trade_date,
            market_id,
            market_name,
            crop_id,
            crop_name,
            avg_price,
            volume
        FROM (
            SELECT *
            FROM changed_rows
            UNION ALL
            SELECT *
            FROM future_refresh_rows
        ) refresh_union
        ORDER BY trade_date, market_id, crop_id
    ),
    refresh_features AS (
        SELECT
            refresh_rows.trade_date,
            refresh_rows.market_id,
            refresh_rows.market_name,
            refresh_rows.crop_id,
            refresh_rows.crop_name,
            refresh_rows.avg_price,
            refresh_rows.volume,

            history.price_lag_1,
            history.price_lag_3,
            history.price_lag_7,
            history.price_lag_14,

            history.volume_lag_1,
            history.volume_lag_3,
            history.volume_lag_7,
            history.volume_lag_14,

            refresh_rows.avg_price / NULLIF(history.price_lag_1, 0) - 1 AS price_return_1,
            refresh_rows.avg_price / NULLIF(history.price_lag_3, 0) - 1 AS price_return_3,
            refresh_rows.avg_price / NULLIF(history.price_lag_7, 0) - 1 AS price_return_7,
            refresh_rows.avg_price / NULLIF(history.price_lag_14, 0) - 1 AS price_return_14,

            refresh_rows.volume / NULLIF(history.volume_lag_1, 0) - 1 AS volume_change_1,
            refresh_rows.volume / NULLIF(history.volume_lag_7, 0) - 1 AS volume_change_7,

            CASE WHEN history.price_count_7 = 7 THEN history.price_ma_7_raw END AS price_ma_7,
            CASE WHEN history.price_count_14 = 14 THEN history.price_ma_14_raw END AS price_ma_14,
            CASE WHEN history.price_count_30 = 30 THEN history.price_ma_30_raw END AS price_ma_30,
            CASE WHEN history.volume_count_7 = 7 THEN history.volume_ma_7_raw END AS volume_ma_7,
            CASE WHEN history.volume_count_14 = 14 THEN history.volume_ma_14_raw END AS volume_ma_14,
            CASE WHEN history.volume_count_30 = 30 THEN history.volume_ma_30_raw END AS volume_ma_30,
            CASE WHEN history.price_count_7 = 7 THEN history.price_std_7_raw END AS price_std_7,
            CASE WHEN history.price_count_14 = 14 THEN history.price_std_14_raw END AS price_std_14,
            CASE WHEN history.price_count_30 = 30 THEN history.price_std_30_raw END AS price_std_30,
            CASE WHEN history.volume_count_30 = 30 THEN history.volume_std_30_raw END AS volume_std_30,

            CASE
                WHEN history.price_count_7 = 7 AND history.price_ma_7_raw > 0
                THEN refresh_rows.avg_price / history.price_ma_7_raw - 1
            END AS price_vs_ma_7,

            CASE
                WHEN history.volume_count_7 = 7 AND history.volume_ma_7_raw > 0
                THEN refresh_rows.volume / history.volume_ma_7_raw - 1
            END AS volume_vs_ma_7,

            EXTRACT(ISODOW FROM refresh_rows.trade_date)::smallint - 1 AS day_of_week,
            EXTRACT(MONTH FROM refresh_rows.trade_date)::smallint AS month,
            sequence_rows.history_sequence_no
        FROM valid_refresh_rows refresh_rows
        CROSS JOIN LATERAL (
            SELECT COUNT(*)::integer AS history_sequence_no
            FROM public.agri_price_daily source_rows
            WHERE source_rows.market_code = refresh_rows.market_id
              AND source_rows.crop_code = refresh_rows.crop_id
              AND source_rows.trans_date <= refresh_rows.trade_date
              AND source_rows.trans_date IS NOT NULL
              AND source_rows.market_code IS NOT NULL
              AND source_rows.crop_code IS NOT NULL
              AND source_rows.avg_price > 0
              AND source_rows.volume > 0
        ) sequence_rows
        LEFT JOIN LATERAL (
            SELECT
                MAX(history_rows.avg_price) FILTER (WHERE history_rows.row_offset = 1) AS price_lag_1,
                MAX(history_rows.avg_price) FILTER (WHERE history_rows.row_offset = 3) AS price_lag_3,
                MAX(history_rows.avg_price) FILTER (WHERE history_rows.row_offset = 7) AS price_lag_7,
                MAX(history_rows.avg_price) FILTER (WHERE history_rows.row_offset = 14) AS price_lag_14,

                MAX(history_rows.volume) FILTER (WHERE history_rows.row_offset = 1) AS volume_lag_1,
                MAX(history_rows.volume) FILTER (WHERE history_rows.row_offset = 3) AS volume_lag_3,
                MAX(history_rows.volume) FILTER (WHERE history_rows.row_offset = 7) AS volume_lag_7,
                MAX(history_rows.volume) FILTER (WHERE history_rows.row_offset = 14) AS volume_lag_14,

                COUNT(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 6) AS price_count_7,
                COUNT(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 13) AS price_count_14,
                COUNT(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS price_count_30,
                COUNT(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 6) AS volume_count_7,
                COUNT(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 13) AS volume_count_14,
                COUNT(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS volume_count_30,

                AVG(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 6) AS price_ma_7_raw,
                AVG(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 13) AS price_ma_14_raw,
                AVG(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS price_ma_30_raw,
                AVG(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 6) AS volume_ma_7_raw,
                AVG(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 13) AS volume_ma_14_raw,
                AVG(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS volume_ma_30_raw,
                STDDEV_POP(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 6) AS price_std_7_raw,
                STDDEV_POP(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 13) AS price_std_14_raw,
                STDDEV_POP(history_rows.avg_price) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS price_std_30_raw,
                STDDEV_POP(history_rows.volume) FILTER (WHERE history_rows.row_offset BETWEEN 0 AND 29) AS volume_std_30_raw
            FROM (
                SELECT
                    0::integer AS row_offset,
                    refresh_rows.avg_price,
                    refresh_rows.volume
                UNION ALL
                SELECT
                    previous_rows.row_offset,
                    previous_rows.avg_price,
                    previous_rows.volume
                FROM (
                    SELECT
                        (ROW_NUMBER() OVER (ORDER BY source_rows.trans_date DESC))::integer AS row_offset,
                        source_rows.avg_price::double precision AS avg_price,
                        source_rows.volume::double precision AS volume
                    FROM public.agri_price_daily source_rows
                    WHERE source_rows.market_code = refresh_rows.market_id
                      AND source_rows.crop_code = refresh_rows.crop_id
                      AND source_rows.trans_date < refresh_rows.trade_date
                      AND source_rows.trans_date IS NOT NULL
                      AND source_rows.market_code IS NOT NULL
                      AND source_rows.crop_code IS NOT NULL
                      AND source_rows.avg_price > 0
                      AND source_rows.volume > 0
                    ORDER BY source_rows.trans_date DESC
                    LIMIT 29
                ) previous_rows
            ) history_rows
        ) history ON TRUE
    ),
    final_feature_rows AS (
        SELECT
            *,
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
        FROM refresh_features
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
            price_ma_30,
            volume_ma_7,
            volume_ma_14,
            volume_ma_30,
            price_std_7,
            price_std_14,
            price_std_30,
            volume_std_30,
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
            final_rows.price_ma_30,
            final_rows.volume_ma_7,
            final_rows.volume_ma_14,
            final_rows.volume_ma_30,
            final_rows.price_std_7,
            final_rows.price_std_14,
            final_rows.price_std_30,
            final_rows.volume_std_30,
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
            price_ma_30 = EXCLUDED.price_ma_30,
            volume_ma_7 = EXCLUDED.volume_ma_7,
            volume_ma_14 = EXCLUDED.volume_ma_14,
            volume_ma_30 = EXCLUDED.volume_ma_30,
            price_std_7 = EXCLUDED.price_std_7,
            price_std_14 = EXCLUDED.price_std_14,
            price_std_30 = EXCLUDED.price_std_30,
            volume_std_30 = EXCLUDED.volume_std_30,
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
    WHERE feature_rows.trade_date BETWEEN v_start_date AND v_end_date
      AND NOT EXISTS (
          SELECT 1
          FROM public.agri_price_daily source_rows
          WHERE source_rows.trans_date = feature_rows.trade_date
            AND source_rows.market_code = feature_rows.market_id
            AND source_rows.crop_code = feature_rows.crop_id
            AND source_rows.trans_date IS NOT NULL
            AND source_rows.market_code IS NOT NULL
            AND source_rows.crop_code IS NOT NULL
            AND source_rows.avg_price > 0
            AND source_rows.volume > 0
      );

    GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

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

    GET DIAGNOSTICS v_pruned_rows = ROW_COUNT;
    v_deleted_rows := v_deleted_rows + v_pruned_rows;

    RETURN QUERY
    SELECT v_upserted_rows, v_deleted_rows, v_computed_at;
END;
$$;

-- Full rebuild helper for first-time deployment or manual repair. Daily Actions should
-- call refresh_agri_price_features(start_date, end_date) to avoid full-table timeouts.
CREATE OR REPLACE FUNCTION public.refresh_agri_price_features_full()
RETURNS TABLE (
    upserted_rows INTEGER,
    deleted_stale_rows INTEGER,
    feature_computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '30min'
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
            COUNT(avg_price) OVER window_30 AS price_count_30,
            COUNT(volume) OVER window_7 AS volume_count_7,
            COUNT(volume) OVER window_14 AS volume_count_14,
            COUNT(volume) OVER window_30 AS volume_count_30,

            AVG(avg_price) OVER window_7 AS price_ma_7_raw,
            AVG(avg_price) OVER window_14 AS price_ma_14_raw,
            AVG(avg_price) OVER window_30 AS price_ma_30_raw,

            AVG(volume) OVER window_7 AS volume_ma_7_raw,
            AVG(volume) OVER window_14 AS volume_ma_14_raw,
            AVG(volume) OVER window_30 AS volume_ma_30_raw,

            STDDEV_POP(avg_price) OVER window_7 AS price_std_7_raw,
            STDDEV_POP(avg_price) OVER window_14 AS price_std_14_raw,
            STDDEV_POP(avg_price) OVER window_30 AS price_std_30_raw,
            STDDEV_POP(volume) OVER window_30 AS volume_std_30_raw
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
            ),
            window_30 AS (
                PARTITION BY market_id, crop_id
                ORDER BY trade_date
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            )
    ),
    rolling_complete AS (
        SELECT
            *,

            CASE WHEN price_count_7 = 7 THEN price_ma_7_raw END AS price_ma_7,
            CASE WHEN price_count_14 = 14 THEN price_ma_14_raw END AS price_ma_14,
            CASE WHEN price_count_30 = 30 THEN price_ma_30_raw END AS price_ma_30,

            CASE WHEN volume_count_7 = 7 THEN volume_ma_7_raw END AS volume_ma_7,
            CASE WHEN volume_count_14 = 14 THEN volume_ma_14_raw END AS volume_ma_14,
            CASE WHEN volume_count_30 = 30 THEN volume_ma_30_raw END AS volume_ma_30,

            CASE WHEN price_count_7 = 7 THEN price_std_7_raw END AS price_std_7,
            CASE WHEN price_count_14 = 14 THEN price_std_14_raw END AS price_std_14,
            CASE WHEN price_count_30 = 30 THEN price_std_30_raw END AS price_std_30,
            CASE WHEN volume_count_30 = 30 THEN volume_std_30_raw END AS volume_std_30
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
            price_ma_30,
            volume_ma_7,
            volume_ma_14,
            volume_ma_30,

            price_std_7,
            price_std_14,
            price_std_30,
            volume_std_30,

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
            price_ma_30,
            volume_ma_7,
            volume_ma_14,
            volume_ma_30,
            price_std_7,
            price_std_14,
            price_std_30,
            volume_std_30,
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
            final_rows.price_ma_30,
            final_rows.volume_ma_7,
            final_rows.volume_ma_14,
            final_rows.volume_ma_30,
            final_rows.price_std_7,
            final_rows.price_std_14,
            final_rows.price_std_30,
            final_rows.volume_std_30,
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
            price_ma_30 = EXCLUDED.price_ma_30,
            volume_ma_7 = EXCLUDED.volume_ma_7,
            volume_ma_14 = EXCLUDED.volume_ma_14,
            volume_ma_30 = EXCLUDED.volume_ma_30,
            price_std_7 = EXCLUDED.price_std_7,
            price_std_14 = EXCLUDED.price_std_14,
            price_std_30 = EXCLUDED.price_std_30,
            volume_std_30 = EXCLUDED.volume_std_30,
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

DROP VIEW IF EXISTS public.api_agri_price_features_latest;

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
    price_ma_30,
    volume_ma_7,
    volume_ma_14,
    volume_ma_30,
    price_std_7,
    price_std_14,
    price_std_30,
    volume_std_30,
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

DROP FUNCTION IF EXISTS public.get_agri_price_feature_history(TEXT, TEXT, DATE, DATE, INTEGER);

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
    price_ma_30 DOUBLE PRECISION,
    volume_ma_7 DOUBLE PRECISION,
    volume_ma_14 DOUBLE PRECISION,
    volume_ma_30 DOUBLE PRECISION,
    price_std_7 DOUBLE PRECISION,
    price_std_14 DOUBLE PRECISION,
    price_std_30 DOUBLE PRECISION,
    volume_std_30 DOUBLE PRECISION,
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
        feature_rows.price_ma_30,
        feature_rows.volume_ma_7,
        feature_rows.volume_ma_14,
        feature_rows.volume_ma_30,
        feature_rows.price_std_7,
        feature_rows.price_std_14,
        feature_rows.price_std_30,
        feature_rows.volume_std_30,
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
REVOKE ALL ON FUNCTION public.refresh_agri_price_features(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_agri_price_features_full() FROM PUBLIC, anon, authenticated;
