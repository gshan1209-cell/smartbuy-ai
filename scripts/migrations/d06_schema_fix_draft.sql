-- D06 schema fix draft.
-- This file is a draft for human review only. Do not run it automatically.
-- It intentionally avoids DROP TABLE and data deletion.

-- ---------------------------------------------------------------------------
-- 1. Pre-checks before enforcing agri_price_daily upsert key.
-- Required because ON CONFLICT (trans_date, crop_code, market_code) needs a
-- matching unique or exclusion constraint, and NULL keys can still create
-- surprising duplicate rows.
-- ---------------------------------------------------------------------------

-- Check duplicate key rows. This must return 0 rows before creating the unique index.
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

-- Check NULL key rows. These must be reviewed before any NOT NULL migration.
SELECT
    COUNT(*) AS null_key_rows
FROM public.agri_price_daily
WHERE crop_code IS NULL
   OR market_code IS NULL;

-- Draft fix if and only if duplicate and NULL checks are clean or have been
-- manually remediated by an approved data-cleaning plan.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_agri_price_daily_trans_crop_market_unique
--     ON public.agri_price_daily (trans_date, crop_code, market_code);

-- Optional hardening after approved NULL remediation. Do not run until the NULL
-- checks above return 0 and downstream loaders are confirmed to always provide codes.
-- ALTER TABLE public.agri_price_daily
--     ALTER COLUMN crop_code SET NOT NULL,
--     ALTER COLUMN market_code SET NOT NULL;

-- Suggested recent-query index for current repository query patterns:
-- price_repository queries by crop_name/market_name and trans_date range, while
-- update/pruning also needs date filtering. Confirm with EXPLAIN before running.
-- CREATE INDEX IF NOT EXISTS idx_agri_price_daily_market_crop_date_desc
--     ON public.agri_price_daily (market_code, crop_code, trans_date DESC);

-- ---------------------------------------------------------------------------
-- 2. price_direction_predictions required indexes.
-- These match scripts/create_price_direction_predictions_table.sql and the
-- current store queries.
-- ---------------------------------------------------------------------------

-- CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_market_crop
--     ON public.price_direction_predictions (market_id, crop_id);

-- CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_base_date
--     ON public.price_direction_predictions (base_date DESC);

-- CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_direction
--     ON public.price_direction_predictions (pred_label_direction);

-- Repository query-specific candidate indexes. Use only if the verification SQL
-- shows the existing indexes are insufficient for actual production volume.
-- query_latest_prediction with crop_id + market_id:
-- CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_pair_staleness_date
--     ON public.price_direction_predictions (market_id, crop_id, data_staleness_days, base_date DESC);

-- query_prediction_list with risk filter and confidence ordering:
-- CREATE INDEX IF NOT EXISTS idx_price_direction_predictions_risk_confidence_date
--     ON public.price_direction_predictions (risk_level, pred_confidence DESC, base_date DESC);

