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
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agri_price_features_daily'
  AND column_name IN (
      'price_ma_30',
      'price_std_30',
      'volume_ma_30',
      'volume_std_30'
  )
ORDER BY column_name;

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

-- 3. Pick a pair with at least 30 valid rows for boundary and numeric checks.
WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 30
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
    feature_rows.price_ma_30,
    feature_rows.price_std_7,
    feature_rows.price_std_14,
    feature_rows.price_std_30,
    feature_rows.volume_ma_30,
    feature_rows.volume_std_30,
    feature_rows.is_feature_complete,
    feature_rows.day_of_week,
    feature_rows.month
FROM public.agri_price_features_daily feature_rows
JOIN selected_pair
  ON selected_pair.market_id = feature_rows.market_id
 AND selected_pair.crop_id = feature_rows.crop_id
WHERE feature_rows.history_sequence_no IN (1, 2, 7, 8, 14, 15, 29, 30)
ORDER BY feature_rows.history_sequence_no;

SELECT
    COUNT(*) FILTER (
        WHERE history_sequence_no BETWEEN 1 AND 29
          AND (
              price_ma_30 IS NOT NULL
              OR price_std_30 IS NOT NULL
              OR volume_ma_30 IS NOT NULL
              OR volume_std_30 IS NOT NULL
          )
    ) AS rows_1_to_29_with_30_features,
    COUNT(*) FILTER (
        WHERE history_sequence_no = 30
          AND (
              price_ma_30 IS NULL
              OR price_std_30 IS NULL
              OR volume_ma_30 IS NULL
              OR volume_std_30 IS NULL
          )
    ) AS row_30_missing_30_features,
    COUNT(*) FILTER (WHERE history_sequence_no = 30) AS row_30_count
FROM public.agri_price_features_daily;

-- 4. Recompute selected columns from source with the same SQL semantics and compare with stored features.
WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 30
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
            WHEN COUNT(avg_price) OVER window_30 = 30
            THEN AVG(avg_price) OVER window_30
        END AS price_ma_30_expected,
        CASE
            WHEN COUNT(volume) OVER window_7 = 7
            THEN AVG(volume) OVER window_7
        END AS volume_ma_7_expected,
        CASE
            WHEN COUNT(volume) OVER window_14 = 14
            THEN AVG(volume) OVER window_14
        END AS volume_ma_14_expected,
        CASE
            WHEN COUNT(volume) OVER window_30 = 30
            THEN AVG(volume) OVER window_30
        END AS volume_ma_30_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_7 = 7
            THEN STDDEV_POP(avg_price) OVER window_7
        END AS price_std_7_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_14 = 14
            THEN STDDEV_POP(avg_price) OVER window_14
        END AS price_std_14_expected,
        CASE
            WHEN COUNT(avg_price) OVER window_30 = 30
            THEN STDDEV_POP(avg_price) OVER window_30
        END AS price_std_30_expected,
        CASE
            WHEN COUNT(volume) OVER window_30 = 30
            THEN STDDEV_POP(volume) OVER window_30
        END AS volume_std_30_expected
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
        ),
        window_30 AS (
            PARTITION BY market_id, crop_id
            ORDER BY trade_date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
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
           OR ABS(feature_rows.price_ma_30 - expected.price_ma_30_expected) > 1e-9
           OR ABS(feature_rows.volume_ma_7 - expected.volume_ma_7_expected) > 1e-9
           OR ABS(feature_rows.volume_ma_14 - expected.volume_ma_14_expected) > 1e-9
           OR ABS(feature_rows.volume_ma_30 - expected.volume_ma_30_expected) > 1e-9
           OR ABS(feature_rows.price_std_7 - expected.price_std_7_expected) > 1e-9
           OR ABS(feature_rows.price_std_14 - expected.price_std_14_expected) > 1e-9
           OR ABS(feature_rows.price_std_30 - expected.price_std_30_expected) > 1e-9
           OR ABS(feature_rows.volume_std_30 - expected.volume_std_30_expected) > 1e-9
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

-- 4b. Manual 30-row average check for one selected 30th-row feature.
WITH selected_feature AS (
    SELECT market_id, crop_id, trade_date
    FROM public.agri_price_features_daily
    WHERE history_sequence_no = 30
      AND price_ma_30 IS NOT NULL
      AND volume_ma_30 IS NOT NULL
    ORDER BY market_id, crop_id, trade_date
    LIMIT 1
),
last_30_source AS (
    SELECT
        source_rows.avg_price::double precision AS avg_price,
        source_rows.volume::double precision AS volume
    FROM selected_feature
    JOIN public.agri_price_daily source_rows
      ON source_rows.market_code = selected_feature.market_id
     AND source_rows.crop_code = selected_feature.crop_id
     AND source_rows.trans_date <= selected_feature.trade_date
    WHERE source_rows.trans_date IS NOT NULL
      AND source_rows.market_code IS NOT NULL
      AND source_rows.crop_code IS NOT NULL
      AND source_rows.avg_price > 0
      AND source_rows.volume > 0
    ORDER BY source_rows.trans_date DESC
    LIMIT 30
)
SELECT
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    feature_rows.price_ma_30,
    AVG(last_30_source.avg_price) AS manual_price_ma_30,
    feature_rows.volume_ma_30,
    AVG(last_30_source.volume) AS manual_volume_ma_30
FROM selected_feature
JOIN public.agri_price_features_daily feature_rows
  ON feature_rows.market_id = selected_feature.market_id
 AND feature_rows.crop_id = selected_feature.crop_id
 AND feature_rows.trade_date = selected_feature.trade_date
CROSS JOIN last_30_source
GROUP BY
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    feature_rows.price_ma_30,
    feature_rows.volume_ma_30;

-- 4c. API Z-score column contract for latest view and history RPC.
SELECT
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'api_agri_price_features_latest'
  AND column_name IN (
      'price_z_30',
      'price_anomaly_level',
      'price_anomaly_direction',
      'volume_log_z_30',
      'volume_anomaly_level',
      'volume_anomaly_direction'
  )
ORDER BY ordinal_position;

SELECT
    p.proname AS routine_name,
    pg_get_function_result(p.oid) AS function_result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_agri_price_feature_history';

WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 31
    ORDER BY COUNT(*) DESC, market_id, crop_id
    LIMIT 1
)
SELECT
    history_rows.trade_date,
    history_rows.market_id,
    history_rows.crop_id,
    history_rows.price_z_30,
    history_rows.price_anomaly_level,
    history_rows.price_anomaly_direction,
    history_rows.volume_log_z_30,
    history_rows.volume_anomaly_level,
    history_rows.volume_anomaly_direction
FROM selected_pair
CROSS JOIN LATERAL public.get_agri_price_feature_history(
    selected_pair.market_id,
    selected_pair.crop_id,
    NULL,
    NULL,
    1
) history_rows;

-- 4d. Z-score history boundary: first 30 rows are insufficient; row 31 can score.
WITH selected_pair AS (
    SELECT market_id, crop_id
    FROM public.agri_price_features_daily
    GROUP BY market_id, crop_id
    HAVING COUNT(*) >= 31
    ORDER BY COUNT(*) DESC, market_id, crop_id
    LIMIT 1
),
history_rows AS (
    SELECT
        rpc_rows.*
    FROM selected_pair
    CROSS JOIN LATERAL public.get_agri_price_feature_history(
        selected_pair.market_id,
        selected_pair.crop_id,
        NULL,
        NULL,
        31
    ) rpc_rows
)
SELECT
    COUNT(*) FILTER (
        WHERE history_sequence_no BETWEEN 1 AND 30
          AND price_z_30 IS NULL
          AND price_anomaly_level = 'insufficient_history'
          AND price_anomaly_direction = 'none'
          AND volume_log_z_30 IS NULL
          AND volume_anomaly_level = 'insufficient_history'
          AND volume_anomaly_direction = 'none'
    ) AS rows_1_to_30_insufficient,
    COUNT(*) FILTER (
        WHERE history_sequence_no BETWEEN 1 AND 30
    ) AS rows_1_to_30_count,
    COUNT(*) FILTER (
        WHERE history_sequence_no = 31
          AND price_anomaly_level <> 'insufficient_history'
          AND volume_anomaly_level <> 'insufficient_history'
    ) AS row_31_scored_count,
    MAX(price_z_30) FILTER (WHERE history_sequence_no = 31) AS row_31_price_z_30,
    MAX(volume_log_z_30) FILTER (WHERE history_sequence_no = 31) AS row_31_volume_log_z_30
FROM history_rows;

-- 4e. Manual price Z-score check for one row with nonzero prior 30-row price stddev.
WITH selected_feature AS (
    SELECT
        feature_rows.market_id,
        feature_rows.crop_id,
        feature_rows.trade_date,
        feature_rows.avg_price,
        previous_rows.trade_date AS previous_trade_date,
        previous_rows.price_ma_30 AS previous_price_ma_30,
        previous_rows.price_std_30 AS previous_price_std_30
    FROM public.agri_price_features_daily feature_rows
    JOIN public.agri_price_features_daily previous_rows
      ON previous_rows.market_id = feature_rows.market_id
     AND previous_rows.crop_id = feature_rows.crop_id
     AND previous_rows.history_sequence_no = feature_rows.history_sequence_no - 1
    WHERE feature_rows.history_sequence_no >= 31
      AND previous_rows.price_ma_30 IS NOT NULL
      AND previous_rows.price_std_30 > 0
    ORDER BY feature_rows.market_id, feature_rows.crop_id, feature_rows.trade_date
    LIMIT 1
),
previous_30_source AS (
    SELECT
        source_rows.avg_price::double precision AS avg_price
    FROM selected_feature
    JOIN public.agri_price_daily source_rows
      ON source_rows.market_code = selected_feature.market_id
     AND source_rows.crop_code = selected_feature.crop_id
     AND source_rows.trans_date < selected_feature.trade_date
    WHERE source_rows.trans_date IS NOT NULL
      AND source_rows.market_code IS NOT NULL
      AND source_rows.crop_code IS NOT NULL
      AND source_rows.avg_price > 0
      AND source_rows.volume > 0
    ORDER BY source_rows.trans_date DESC
    LIMIT 30
),
api_row AS (
    SELECT
        rpc_rows.price_z_30
    FROM selected_feature
    CROSS JOIN LATERAL public.get_agri_price_feature_history(
        selected_feature.market_id,
        selected_feature.crop_id,
        selected_feature.trade_date,
        selected_feature.trade_date,
        1
    ) rpc_rows
)
SELECT
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    selected_feature.previous_trade_date,
    selected_feature.previous_price_ma_30,
    AVG(previous_30_source.avg_price) AS manual_previous_price_ma_30,
    selected_feature.previous_price_ma_30 - AVG(previous_30_source.avg_price) AS price_mean_diff,
    selected_feature.previous_price_std_30,
    STDDEV_POP(previous_30_source.avg_price) AS manual_previous_price_std_30,
    selected_feature.previous_price_std_30 - STDDEV_POP(previous_30_source.avg_price) AS price_std_diff,
    api_row.price_z_30,
    (
        selected_feature.avg_price - selected_feature.previous_price_ma_30
    ) / selected_feature.previous_price_std_30 AS manual_price_z_30,
    api_row.price_z_30 - (
        (selected_feature.avg_price - selected_feature.previous_price_ma_30)
        / selected_feature.previous_price_std_30
    ) AS price_z_diff
FROM selected_feature
CROSS JOIN previous_30_source
CROSS JOIN api_row
GROUP BY
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    selected_feature.avg_price,
    selected_feature.previous_trade_date,
    selected_feature.previous_price_ma_30,
    selected_feature.previous_price_std_30,
    api_row.price_z_30;

-- 4f. Manual volume log Z-score check for one row with nonzero prior 30-row log-volume stddev.
WITH candidate_features AS (
    SELECT
        feature_rows.*,
        COUNT(*) FILTER (
            WHERE feature_rows.volume > 0
        ) OVER volume_log_history_window AS previous_volume_log_count_30,
        AVG(
            CASE
                WHEN feature_rows.volume > 0 THEN LN(feature_rows.volume)
            END
        ) OVER volume_log_history_window AS previous_volume_log_ma_30,
        STDDEV_POP(
            CASE
                WHEN feature_rows.volume > 0 THEN LN(feature_rows.volume)
            END
        ) OVER volume_log_history_window AS previous_volume_log_std_30
    FROM public.agri_price_features_daily feature_rows
    WINDOW volume_log_history_window AS (
        PARTITION BY feature_rows.market_id, feature_rows.crop_id
        ORDER BY feature_rows.trade_date
        ROWS BETWEEN 30 PRECEDING AND 1 PRECEDING
    )
),
selected_feature AS (
    SELECT
        market_id,
        crop_id,
        trade_date,
        volume,
        previous_volume_log_ma_30,
        previous_volume_log_std_30
    FROM candidate_features
    WHERE previous_volume_log_count_30 = 30
      AND previous_volume_log_std_30 > 0
    ORDER BY market_id, crop_id, trade_date
    LIMIT 1
),
previous_30_source AS (
    SELECT
        source_rows.volume::double precision AS volume
    FROM selected_feature
    JOIN public.agri_price_daily source_rows
      ON source_rows.market_code = selected_feature.market_id
     AND source_rows.crop_code = selected_feature.crop_id
     AND source_rows.trans_date < selected_feature.trade_date
    WHERE source_rows.trans_date IS NOT NULL
      AND source_rows.market_code IS NOT NULL
      AND source_rows.crop_code IS NOT NULL
      AND source_rows.avg_price > 0
      AND source_rows.volume > 0
    ORDER BY source_rows.trans_date DESC
    LIMIT 30
),
api_row AS (
    SELECT
        rpc_rows.volume_log_z_30
    FROM selected_feature
    CROSS JOIN LATERAL public.get_agri_price_feature_history(
        selected_feature.market_id,
        selected_feature.crop_id,
        selected_feature.trade_date,
        selected_feature.trade_date,
        1
    ) rpc_rows
)
SELECT
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    selected_feature.previous_volume_log_ma_30,
    AVG(LN(previous_30_source.volume)) AS manual_previous_volume_log_ma_30,
    selected_feature.previous_volume_log_ma_30 - AVG(LN(previous_30_source.volume)) AS volume_log_mean_diff,
    selected_feature.previous_volume_log_std_30,
    STDDEV_POP(LN(previous_30_source.volume)) AS manual_previous_volume_log_std_30,
    selected_feature.previous_volume_log_std_30 - STDDEV_POP(LN(previous_30_source.volume)) AS volume_log_std_diff,
    api_row.volume_log_z_30,
    (
        LN(selected_feature.volume) - selected_feature.previous_volume_log_ma_30
    ) / selected_feature.previous_volume_log_std_30 AS manual_volume_log_z_30,
    api_row.volume_log_z_30 - (
        (LN(selected_feature.volume) - selected_feature.previous_volume_log_ma_30)
        / selected_feature.previous_volume_log_std_30
    ) AS volume_log_z_diff
FROM selected_feature
CROSS JOIN previous_30_source
CROSS JOIN api_row
GROUP BY
    selected_feature.market_id,
    selected_feature.crop_id,
    selected_feature.trade_date,
    selected_feature.volume,
    selected_feature.previous_volume_log_ma_30,
    selected_feature.previous_volume_log_std_30,
    api_row.volume_log_z_30;

-- 4g. Synthetic anomaly thresholds.
WITH synthetic_z AS (
    SELECT *
    FROM (
        VALUES
            (1.99::double precision),
            (2.00::double precision),
            (-2.00::double precision),
            (2.99::double precision),
            (3.00::double precision),
            (-3.00::double precision)
    ) AS z_cases(z_value)
)
SELECT
    z_value,
    CASE
        WHEN ABS(z_value) < 2 THEN 'normal'
        WHEN ABS(z_value) < 3 THEN 'anomaly'
        ELSE 'extreme_anomaly'
    END AS anomaly_level,
    CASE
        WHEN z_value >= 2 THEN 'high'
        WHEN z_value <= -2 THEN 'low'
        ELSE 'none'
    END AS anomaly_direction
FROM synthetic_z
ORDER BY z_value;

-- 4h. Synthetic zero-stddev branch.
WITH zero_std_cases AS (
    SELECT *
    FROM (
        VALUES
            ('equal'::text, 10.0::double precision, 10.0::double precision, 0.0::double precision),
            ('high'::text, 11.0::double precision, 10.0::double precision, 0.0::double precision),
            ('low'::text, 9.0::double precision, 10.0::double precision, 0.0::double precision)
    ) AS cases(case_name, current_value, history_mean, history_stddev)
),
scored AS (
    SELECT
        *,
        CASE
            WHEN history_stddev = 0
              AND current_value = history_mean
            THEN 0::double precision
            WHEN history_stddev = 0
            THEN NULL
            ELSE (current_value - history_mean) / history_stddev
        END AS z_value
    FROM zero_std_cases
)
SELECT
    case_name,
    z_value,
    CASE
        WHEN history_stddev = 0
          AND current_value <> history_mean
        THEN 'extreme_anomaly'
        WHEN ABS(z_value) < 2
        THEN 'normal'
        WHEN ABS(z_value) < 3
        THEN 'anomaly'
        ELSE 'extreme_anomaly'
    END AS anomaly_level,
    CASE
        WHEN history_stddev = 0
          AND current_value > history_mean
        THEN 'high'
        WHEN history_stddev = 0
          AND current_value < history_mean
        THEN 'low'
        WHEN z_value >= 2
        THEN 'high'
        WHEN z_value <= -2
        THEN 'low'
        ELSE 'none'
    END AS anomaly_direction
FROM scored
ORDER BY case_name;

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
