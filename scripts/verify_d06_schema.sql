-- D06 schema verification queries.
-- Read-only only: this file must not contain ALTER, CREATE, INSERT, UPDATE, DELETE, DROP, or policy changes.

-- 1. Confirm required D06 tables exist.
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'agri_price_daily',
      'data_update_logs',
      'price_direction_predictions',
      'prediction_results',
      'dim_crop',
      'dim_market',
      'market_rest_days'
  )
ORDER BY table_name;

-- 2. agri_price_daily column types and nullability.
SELECT
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agri_price_daily'
ORDER BY ordinal_position;

-- 3. agri_price_daily primary/unique constraints and indexes.
SELECT
    con.conname,
    con.contype,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'agri_price_daily'
  AND con.contype IN ('p', 'u', 'c')
ORDER BY con.conname;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'agri_price_daily'
ORDER BY indexname;

-- 4. agri_price_daily duplicate and NULL-key checks before adding any unique constraint.
SELECT
    trans_date,
    crop_code,
    market_code,
    COUNT(*) AS row_count
FROM public.agri_price_daily
GROUP BY trans_date, crop_code, market_code
HAVING COUNT(*) > 1
ORDER BY row_count DESC, trans_date DESC
LIMIT 100;

SELECT
    COUNT(*) AS null_key_rows
FROM public.agri_price_daily
WHERE crop_code IS NULL
   OR market_code IS NULL;

SELECT
    COUNT(*) AS null_crop_code_rows
FROM public.agri_price_daily
WHERE crop_code IS NULL;

SELECT
    COUNT(*) AS null_market_code_rows
FROM public.agri_price_daily
WHERE market_code IS NULL;

SELECT
    COUNT(*) AS agri_price_daily_rows,
    MIN(trans_date) AS min_trans_date,
    MAX(trans_date) AS max_trans_date,
    MAX(updated_at) AS max_updated_at
FROM public.agri_price_daily;

-- 5. price_direction_predictions column types and nullability.
SELECT
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'price_direction_predictions'
ORDER BY ordinal_position;

-- 6. price_direction_predictions primary/unique/check constraints and indexes.
SELECT
    con.conname,
    con.contype,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'price_direction_predictions'
  AND con.contype IN ('p', 'u', 'c')
ORDER BY con.conname;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'price_direction_predictions'
ORDER BY indexname;

-- 7. price_direction_predictions payload quality checks.
SELECT
    COUNT(*) AS prediction_rows,
    MIN(base_date) AS min_base_date,
    MAX(base_date) AS max_base_date,
    MAX(global_latest_trade_date) AS max_global_latest_trade_date,
    MAX(prepared_at) AS max_prepared_at,
    MAX(updated_at) AS max_updated_at
FROM public.price_direction_predictions;

SELECT
    COUNT(*) AS bad_upsert_key_rows
FROM public.price_direction_predictions
WHERE upsert_key IS DISTINCT FROM market_id || '__' || crop_id || '__' || base_date::text;

SELECT
    upsert_key,
    COUNT(*) AS row_count
FROM public.price_direction_predictions
GROUP BY upsert_key
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 100;

SELECT
    COUNT(*) AS bad_probability_sum_rows
FROM public.price_direction_predictions
WHERE ABS((prob_down + prob_flat + prob_up) - 1.0) > 0.000001;

SELECT
    COUNT(*) AS bad_confidence_rows
FROM public.price_direction_predictions
WHERE ABS(pred_confidence - GREATEST(prob_down, prob_flat, prob_up)) > 0.000001;

SELECT
    COUNT(*) AS stale_prediction_rows
FROM public.price_direction_predictions
WHERE data_staleness_days > 7;

SELECT
    COUNT(*) AS invalid_prediction_target_rows
FROM public.price_direction_predictions
WHERE prediction_target <> 'next_trade_day';

-- 8. RLS and policy checks.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('price_direction_predictions', 'agri_price_daily');

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('price_direction_predictions', 'agri_price_daily')
ORDER BY tablename, policyname;

