-- 點數／優惠券 migration 驗證：在 Supabase SQL Editor 執行，應全部回傳 true。
SELECT table_name, to_regclass('public.' || table_name) IS NOT NULL AS table_exists
FROM (VALUES
    ('member_points_accounts'),
    ('member_point_transactions'),
    ('coupons'),
    ('member_coupons')
) AS expected(table_name);

SELECT
    (SELECT data_type FROM information_schema.columns WHERE table_name = 'member_points_accounts' AND column_name = 'member_id') = 'integer'
    AS member_id_type_matches,
    EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'member_point_transactions_member_created_idx'
    ) AS transaction_index_exists,
    EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.coupons'::regclass AND conname = 'coupons_expiry_after_start'
    ) AS coupon_expiry_check_exists,
    EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.member_coupons'::regclass AND conname = 'member_coupons_member_id_coupon_id_key'
    ) AS one_coupon_per_member_check_exists;
