-- agri_price_features_daily verification queries.
-- Read-only only: this file must not contain ALTER, CREATE, INSERT, UPDATE, DELETE, DROP, or policy changes.

-- 1. Source duplicate check. This must return 0 rows before refresh.
SELECT
    trans_date,
    market_code,
    crop_code,
    COUNT(*) AS row_count
FROM public.agri_price_daily
WHERE trans_date IS NOT NULL
  AND market_code IS NOT NULL
  AND crop_code IS NOT NULL
  AND avg_price > 0
  AND volume > 0
GROUP BY trans_date, market_code, crop_code
HAVING COUNT(*) > 1
ORDER BY row_count DESC, trans_date DESC
LIMIT 100;

-- 2. Feature table uniqueness and basic range.
SELECT
    COUNT(*) AS feature_rows,
    COUNT(DISTINCT (trade_date, market_id, crop_id)) AS distinct_feature_keys,
    MIN(trade_date) AS min_trade_date,
    MAX(trade_date) AS max_trade_date,
    MAX(feature_computed_at) AS max_feature_computed_at
FROM public.agri_price_features_daily;

SELECT
    trade_date,
    market_id,
    crop_id,
    COUNT(*) AS row_count
FROM public.agri_price_features_daily
GROUP BY trade_date, market_id, crop_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC, trade_date DESC
LIMIT 100;

-- 3. Pick a pair with at least 20 valid rows for boundary and numeric checks.
WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 20
    ORDER BY COUNT(*) DESC, market_id, crop_id
    LIMIT 1
)
SELECT
    feature_rows.trade_date,
    feature_rows.market_id,
    feature_rows.crop_id,
    feature_rows.history_sequence_no,
    feature_rows.avg_price,
    feature_rows.volume,
    feature_rows.price_lag_1,
    feature_rows.price_lag_7,
    feature_rows.price_lag_14,
    feature_rows.price_ma_7,
    feature_rows.price_ma_14,
    feature_rows.price_std_7,
    feature_rows.price_std_14,
    feature_rows.is_feature_complete,
    feature_rows.day_of_week,
    feature_rows.month
FROM public.agri_price_features_daily feature_rows
JOIN selected_pair
  ON selected_pair.market_id = feature_rows.market_id
 AND selected_pair.crop_id = feature_rows.crop_id
WHERE feature_rows.history_sequence_no IN (1, 2, 7, 8, 14, 15)
ORDER BY feature_rows.history_sequence_no;

-- 4. Recompute selected columns from source with the same SQL semantics and compare with stored features.
WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 20
    ORDER BY COUNT(*) DESC, market_id, crop_id
    LIMIT 1
),
valid_source AS (
    SELECT
        source_rows.trans_date::date AS trade_date,
        source_rows.market_code::text AS market_id,
        source_rows.crop_code::text AS crop_id,
        source_rows.avg_price::double precision AS avg_price,
        source_rows.volume::double precision AS volume
    FROM public.agri_price_daily source_rows
    JOIN selected_pair
      ON selected_pair.market_id = source_rows.market_code
     AND selected_pair.crop_id = source_rows.crop_code
    WHERE source_rows.trans_date IS NOT NULL
      AND source_rows.market_code IS NOT NULL
      AND source_rows.crop_code IS NOT NULL
      AND source_rows.avg_price > 0
      AND source_rows.volume > 0
),
recomputed AS (
    SELECT
        *,
        ROW_NUMBER() OVER pair_window AS history_sequence_no,
        LAG(avg_price, 1) OVER pair_window AS price_lag_1_expected,
        LAG(avg_price, 7) OVER pair_window AS price_lag_7_expected,
        LAG(avg_price, 14) OVER pair_window AS price_lag_14_expected,
        LAG(volume, 1) OVER pair_window AS volume_lag_1_expected,
        LAG(volume, 7) OVER pair_window AS volume_lag_7_expected,
        LAG(volume, 14) OVER pair_window AS volume_lag_14_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_7 = 7
            THEN AVG(avg_price) OVER window_7
        END AS price_ma_7_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_14 = 14
            THEN AVG(avg_price) OVER window_14
        END AS price_ma_14_expected,
        CASE
            WHEN COUNT(volume) OVER window_7 = 7
            THEN AVG(volume) OVER window_7
        END AS volume_ma_7_expected,
        CASE
            WHEN COUNT(volume) OVER window_14 = 14
            THEN AVG(volume) OVER window_14
        END AS volume_ma_14_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_7 = 7
            THEN STDDEV_POP(avg_price) OVER window_7
        END AS price_std_7_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_14 = 14
            THEN STDDEV_POP(avg_price) OVER window_14
        END AS price_std_14_expected
    FROM valid_source
    WINDOW
        pair_window AS (
            PARTITION BY market_id, crop_id
            ORDER BY trade_date
        ),
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
expected AS (
    SELECT
        *,
        avg_price / NULLIF(price_lag_1_expected, 0) - 1 AS price_return_1_expected,
        avg_price / NULLIF(price_lag_7_expected, 0) - 1 AS price_return_7_expected,
        avg_price / NULLIF(price_lag_14_expected, 0) - 1 AS price_return_14_expected,
        volume / NULLIF(volume_lag_1_expected, 0) - 1 AS volume_change_1_expected,
        volume / NULLIF(volume_lag_7_expected, 0) - 1 AS volume_change_7_expected,
        CASE
            WHEN price_ma_7_expected > 0
            THEN avg_price / price_ma_7_expected - 1
        END AS price_vs_ma_7_expected,
        CASE
            WHEN volume_ma_7_expected > 0
            THEN volume / volume_ma_7_expected - 1
        END AS volume_vs_ma_7_expected,
        EXTRACT(ISODOW FROM trade_date)::smallint - 1 AS day_of_week_expected,
        EXTRACT(MONTH FROM trade_date)::smallint AS month_expected
    FROM recomputed
)
SELECT
    COUNT(*) AS compared_rows,
    COUNT(*) FILTER (
        WHERE ABS(feature_rows.price_lag_1 - expected.price_lag_1_expected) > 1e-9
           OR ABS(feature_rows.price_lag_7 - expected.price_lag_7_expected) > 1e-9
           OR ABS(feature_rows.price_lag_14 - expected.price_lag_14_expected) > 1e-9
           OR ABS(feature_rows.volume_lag_1 - expected.volume_lag_1_expected) > 1e-9
           OR ABS(feature_rows.volume_lag_7 - expected.volume_lag_7_expected) > 1e-9
           OR ABS(feature_rows.volume_lag_14 - expected.volume_lag_14_expected) > 1e-9
           OR ABS(feature_rows.price_return_1 - expected.price_return_1_expected) > 1e-9
           OR ABS(feature_rows.price_return_7 - expected.price_return_7_expected) > 1e-9
           OR ABS(feature_rows.price_return_14 - expected.price_return_14_expected) > 1e-9
           OR ABS(feature_rows.volume_change_1 - expected.volume_change_1_expected) > 1e-9
           OR ABS(feature_rows.volume_change_7 - expected.volume_change_7_expected) > 1e-9
           OR ABS(feature_rows.price_ma_7 - expected.price_ma_7_expected) > 1e-9
           OR ABS(feature_rows.price_ma_14 - expected.price_ma_14_expected) > 1e-9
           OR ABS(feature_rows.volume_ma_7 - expected.volume_ma_7_expected) > 1e-9
           OR ABS(feature_rows.volume_ma_14 - expected.volume_ma_14_expected) > 1e-9
           OR ABS(feature_rows.price_std_7 - expected.price_std_7_expected) > 1e-9
           OR ABS(feature_rows.price_std_14 - expected.price_std_14_expected) > 1e-9
           OR ABS(feature_rows.price_vs_ma_7 - expected.price_vs_ma_7_expected) > 1e-9
           OR ABS(feature_rows.volume_vs_ma_7 - expected.volume_vs_ma_7_expected) > 1e-9
           OR feature_rows.day_of_week <> expected.day_of_week_expected
           OR feature_rows.month <> expected.month_expected
    ) AS mismatch_rows
FROM public.agri_price_features_daily feature_rows
JOIN expected
  ON expected.trade_date = feature_rows.trade_date
 AND expected.market_id = feature_rows.market_id
 AND expected.crop_id = feature_rows.crop_id;

-- 5. Confirm excluded training/cycle columns are absent from table and latest API view.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('agri_price_features_daily', 'api_agri_price_features_latest')
  AND column_name IN (
      'month_sin',
      'month_cos',
      'next_trade_date',
      'next_avg_price',
      'next_return',
      'label_direction',
      'label_name',
      'target'
  )
ORDER BY table_name, column_name;

-- 6. RLS and privilege inspection.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'agri_price_features_daily';

SELECT
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('agri_price_features_daily', 'api_agri_price_features_latest')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE specific_schema = 'public'
  AND routine_name IN ('refresh_agri_price_features', 'get_agri_price_feature_history')
ORDER BY routine_name;
