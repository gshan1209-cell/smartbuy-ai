-- Verify the SmartBuy AI notifications schema.

WITH
expected_tables(table_name) AS (
    VALUES
        ('notifications')
),
expected_columns(column_name, expected_type, should_be_not_null, should_be_identity) AS (
    VALUES
        ('id', 'integer', TRUE, TRUE),
        ('recipient_member_id', 'integer', TRUE, FALSE),
        ('actor_member_id', 'integer', TRUE, FALSE),
        ('type', 'text', TRUE, FALSE),
        ('post_id', 'integer', TRUE, FALSE),
        ('comment_id', 'integer', FALSE, FALSE),
        ('is_read', 'boolean', TRUE, FALSE),
        ('created_at', 'timestamp with time zone', TRUE, FALSE)
),
actual_columns AS (
    SELECT
        a.attname AS column_name,
        format_type(a.atttypid, a.atttypmod) AS actual_type,
        a.attnotnull AS is_not_null,
        a.attidentity IN ('a', 'd') AS is_identity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND a.attnum > 0
      AND NOT a.attisdropped
),
actual_pks AS (
    SELECT
        array_agg(att.attname::text ORDER BY array_position(con.conkey, att.attnum)) AS actual_columns
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.conrelid = to_regclass('public.notifications')
      AND con.contype = 'p'
    GROUP BY con.conrelid
),
actual_checks AS (
    SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_def
    FROM pg_constraint con
    WHERE con.conrelid = to_regclass('public.notifications')
      AND con.conname = 'notifications_type_check'
      AND con.contype = 'c'
),
expected_fks(constraint_name, local_columns, foreign_table, foreign_columns, delete_rule) AS (
    VALUES
        ('notifications_recipient_member_id_fkey', ARRAY['recipient_member_id']::text[], 'members', ARRAY['id']::text[], 'c'),
        ('notifications_actor_member_id_fkey', ARRAY['actor_member_id']::text[], 'members', ARRAY['id']::text[], 'c'),
        ('notifications_post_id_fkey', ARRAY['post_id']::text[], 'mutual_aid_posts', ARRAY['id']::text[], 'c'),
        ('notifications_comment_id_fkey', ARRAY['comment_id']::text[], 'mutual_aid_comments', ARRAY['id']::text[], 'c')
),
actual_fks AS (
    SELECT
        con.conname AS constraint_name,
        array_agg(local_att.attname::text ORDER BY local_cols.ord) AS local_columns,
        foreign_cls.relname AS foreign_table,
        array_agg(foreign_att.attname::text ORDER BY foreign_cols.ord) AS foreign_columns,
        con.confdeltype AS delete_rule
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_class foreign_cls ON foreign_cls.oid = con.confrelid
    JOIN pg_namespace foreign_ns ON foreign_ns.oid = foreign_cls.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS local_cols(attnum, ord) ON TRUE
    JOIN pg_attribute local_att ON local_att.attrelid = con.conrelid AND local_att.attnum = local_cols.attnum
    JOIN unnest(con.confkey) WITH ORDINALITY AS foreign_cols(attnum, ord) ON foreign_cols.ord = local_cols.ord
    JOIN pg_attribute foreign_att ON foreign_att.attrelid = con.confrelid AND foreign_att.attnum = foreign_cols.attnum
    WHERE ns.nspname = 'public'
      AND foreign_ns.nspname = 'public'
      AND cls.relname = 'notifications'
      AND con.contype = 'f'
    GROUP BY con.conname, foreign_cls.relname, con.confdeltype
),
expected_indexes(index_name) AS (
    VALUES
        ('notifications_recipient_unread_idx'),
        ('notifications_actor_post_type_idx')
),
expected_roles(role_name) AS (
    VALUES
        ('anon'),
        ('authenticated')
),
role_privileges AS (
    SELECT
        role_name,
        COALESCE(has_table_privilege(role_name, to_regclass('public.notifications'), 'SELECT'), FALSE) AS can_select,
        COALESCE(has_table_privilege(role_name, to_regclass('public.notifications'), 'INSERT'), FALSE) AS can_insert,
        COALESCE(has_table_privilege(role_name, to_regclass('public.notifications'), 'UPDATE'), FALSE) AS can_update,
        COALESCE(has_table_privilege(role_name, to_regclass('public.notifications'), 'DELETE'), FALSE) AS can_delete
    FROM expected_roles
    WHERE EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = role_name
    )
)
SELECT 'table_exists:' || e.table_name AS check_name,
       to_regclass('public.' || e.table_name) IS NOT NULL AS passed,
       COALESCE(to_regclass('public.' || e.table_name)::text, 'missing') AS detail
FROM expected_tables e

UNION ALL

SELECT 'column:notifications.' || e.column_name AS check_name,
       a.actual_type = e.expected_type
           AND a.is_not_null = e.should_be_not_null
           AND (NOT e.should_be_identity OR a.is_identity) AS passed,
       'expected type=' || e.expected_type
           || ', actual type=' || COALESCE(a.actual_type, 'missing')
           || ', not_null=' || COALESCE(a.is_not_null::text, 'missing')
           || ', identity=' || COALESCE(a.is_identity::text, 'missing') AS detail
FROM expected_columns e
LEFT JOIN actual_columns a ON a.column_name = e.column_name

UNION ALL

SELECT 'primary_key:notifications' AS check_name,
       COALESCE(a.actual_columns = ARRAY['id']::text[], FALSE) AS passed,
       'expected={id}, actual=' || COALESCE(a.actual_columns::text, 'missing') AS detail
FROM (VALUES (ARRAY['id']::text[])) AS e(expected_columns)
LEFT JOIN actual_pks a ON TRUE

UNION ALL

SELECT 'foreign_key:' || e.constraint_name AS check_name,
       a.local_columns = e.local_columns
           AND a.foreign_table = e.foreign_table
           AND a.foreign_columns = e.foreign_columns
           AND a.delete_rule = e.delete_rule AS passed,
       'expected ' || e.local_columns::text || ' -> ' || e.foreign_table || e.foreign_columns::text
           || ' ON DELETE CASCADE; actual '
           || COALESCE(a.local_columns::text, 'missing') || ' -> '
           || COALESCE(a.foreign_table::text, 'missing') || COALESCE(a.foreign_columns::text, '')
           || ', delete_rule=' || COALESCE(a.delete_rule::text, 'missing') AS detail
FROM expected_fks e
LEFT JOIN actual_fks a ON a.constraint_name = e.constraint_name

UNION ALL

SELECT 'check_constraint:notifications_type_check' AS check_name,
       actual_checks.constraint_name IS NOT NULL
           AND actual_checks.constraint_def LIKE '%mutual_aid_reply%'
           AND actual_checks.constraint_def LIKE '%mutual_aid_like%' AS passed,
       COALESCE(actual_checks.constraint_def, 'missing') AS detail
FROM (VALUES ('notifications_type_check')) AS e(constraint_name)
LEFT JOIN actual_checks ON actual_checks.constraint_name = e.constraint_name

UNION ALL

SELECT 'index:' || e.index_name AS check_name,
       idx.indexname IS NOT NULL AS passed,
       COALESCE(idx.indexdef, 'missing') AS detail
FROM expected_indexes e
LEFT JOIN pg_indexes idx
  ON idx.schemaname = 'public'
 AND idx.indexname = e.index_name

UNION ALL

SELECT 'rls:enabled:notifications' AS check_name,
       COALESCE(cls.relrowsecurity, FALSE) AS passed,
       'rls_enabled=' || COALESCE(cls.relrowsecurity::text, 'missing')
           || ', rls_forced=' || COALESCE(cls.relforcerowsecurity::text, 'missing') AS detail
FROM (VALUES ('notifications')) AS e(table_name)
LEFT JOIN pg_class cls ON cls.oid = to_regclass('public.' || e.table_name)

UNION ALL

SELECT 'permissions:no_anon_authenticated_dml' AS check_name,
       NOT EXISTS (
           SELECT 1
           FROM role_privileges
           WHERE can_select OR can_insert OR can_update OR can_delete
       ) AS passed,
       COALESCE((
           SELECT string_agg(
               role_name
                   || ': select=' || can_select::text
                   || ', insert=' || can_insert::text
                   || ', update=' || can_update::text
                   || ', delete=' || can_delete::text,
               '; '
               ORDER BY role_name
           )
           FROM role_privileges
       ), 'anon/authenticated roles not present') AS detail
ORDER BY check_name;
