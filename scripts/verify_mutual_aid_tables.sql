-- Verify the SmartBuy AI mutual-aid schema.
-- The final integration section is wrapped in a transaction and rolled back.

WITH
expected_tables(table_name) AS (
    VALUES
        ('mutual_aid_posts'),
        ('mutual_aid_comments'),
        ('mutual_aid_likes'),
        ('mutual_aid_saved')
),
expected_columns(table_name, column_name, expected_type, should_be_not_null, should_be_identity) AS (
    VALUES
        ('mutual_aid_posts', 'id', 'integer', TRUE, TRUE),
        ('mutual_aid_posts', 'member_id', 'integer', TRUE, FALSE),
        ('mutual_aid_posts', 'type', 'text', TRUE, FALSE),
        ('mutual_aid_posts', 'content', 'text', TRUE, FALSE),
        ('mutual_aid_posts', 'farm_name', 'text', FALSE, FALSE),
        ('mutual_aid_posts', 'location_city', 'text', FALSE, FALSE),
        ('mutual_aid_posts', 'location_addr', 'text', FALSE, FALSE),
        ('mutual_aid_posts', 'location_lat', 'double precision', FALSE, FALSE),
        ('mutual_aid_posts', 'location_lng', 'double precision', FALSE, FALSE),
        ('mutual_aid_posts', 'images', 'text[]', TRUE, FALSE),
        ('mutual_aid_posts', 'status', 'text', TRUE, FALSE),
        ('mutual_aid_posts', 'like_count', 'integer', TRUE, FALSE),
        ('mutual_aid_posts', 'created_at', 'timestamp with time zone', TRUE, FALSE),
        ('mutual_aid_posts', 'updated_at', 'timestamp with time zone', TRUE, FALSE),
        ('mutual_aid_comments', 'id', 'integer', TRUE, TRUE),
        ('mutual_aid_comments', 'post_id', 'integer', TRUE, FALSE),
        ('mutual_aid_comments', 'member_id', 'integer', TRUE, FALSE),
        ('mutual_aid_comments', 'content', 'text', TRUE, FALSE),
        ('mutual_aid_comments', 'created_at', 'timestamp with time zone', TRUE, FALSE),
        ('mutual_aid_likes', 'post_id', 'integer', TRUE, FALSE),
        ('mutual_aid_likes', 'member_id', 'integer', TRUE, FALSE),
        ('mutual_aid_saved', 'post_id', 'integer', TRUE, FALSE),
        ('mutual_aid_saved', 'member_id', 'integer', TRUE, FALSE)
),
actual_columns AS (
    SELECT
        c.relname AS table_name,
        a.attname AS column_name,
        format_type(a.atttypid, a.atttypmod) AS actual_type,
        a.attnotnull AS is_not_null,
        a.attidentity IN ('a', 'd') AS is_identity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')
      AND a.attnum > 0
      AND NOT a.attisdropped
),
expected_pks(table_name, expected_columns) AS (
    VALUES
        ('mutual_aid_posts', ARRAY['id']::text[]),
        ('mutual_aid_comments', ARRAY['id']::text[]),
        ('mutual_aid_likes', ARRAY['post_id', 'member_id']::text[]),
        ('mutual_aid_saved', ARRAY['post_id', 'member_id']::text[])
),
actual_pks AS (
    SELECT
        cls.relname AS table_name,
        array_agg(att.attname::text ORDER BY array_position(con.conkey, att.attnum)) AS actual_columns
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE ns.nspname = 'public'
      AND cls.relname IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')
      AND con.contype = 'p'
    GROUP BY cls.relname
),
expected_fks(table_name, constraint_name, local_columns, foreign_table, foreign_columns, delete_rule) AS (
    VALUES
        ('mutual_aid_posts', 'mutual_aid_posts_member_id_fkey', ARRAY['member_id']::text[], 'members', ARRAY['id']::text[], 'c'),
        ('mutual_aid_comments', 'mutual_aid_comments_post_id_fkey', ARRAY['post_id']::text[], 'mutual_aid_posts', ARRAY['id']::text[], 'c'),
        ('mutual_aid_comments', 'mutual_aid_comments_member_id_fkey', ARRAY['member_id']::text[], 'members', ARRAY['id']::text[], 'c'),
        ('mutual_aid_likes', 'mutual_aid_likes_post_id_fkey', ARRAY['post_id']::text[], 'mutual_aid_posts', ARRAY['id']::text[], 'c'),
        ('mutual_aid_likes', 'mutual_aid_likes_member_id_fkey', ARRAY['member_id']::text[], 'members', ARRAY['id']::text[], 'c'),
        ('mutual_aid_saved', 'mutual_aid_saved_post_id_fkey', ARRAY['post_id']::text[], 'mutual_aid_posts', ARRAY['id']::text[], 'c'),
        ('mutual_aid_saved', 'mutual_aid_saved_member_id_fkey', ARRAY['member_id']::text[], 'members', ARRAY['id']::text[], 'c')
),
actual_fks AS (
    SELECT
        cls.relname AS table_name,
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
      AND foreign_ns.nspname IN ('public', 'auth')
      AND cls.relname IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')
      AND con.contype = 'f'
    GROUP BY cls.relname, con.conname, foreign_cls.relname, con.confdeltype
),
expected_checks(table_name, constraint_name) AS (
    VALUES
        ('mutual_aid_posts', 'mutual_aid_posts_type_check'),
        ('mutual_aid_posts', 'mutual_aid_posts_content_not_blank'),
        ('mutual_aid_posts', 'mutual_aid_posts_images_max_check'),
        ('mutual_aid_posts', 'mutual_aid_posts_status_check'),
        ('mutual_aid_posts', 'mutual_aid_posts_like_count_nonnegative'),
        ('mutual_aid_posts', 'mutual_aid_posts_location_lat_check'),
        ('mutual_aid_posts', 'mutual_aid_posts_location_lng_check'),
        ('mutual_aid_comments', 'mutual_aid_comments_content_not_blank')
),
expected_indexes(index_name) AS (
    VALUES
        ('mutual_aid_posts_created_at_idx'),
        ('mutual_aid_posts_type_idx'),
        ('mutual_aid_posts_location_city_idx'),
        ('mutual_aid_posts_like_count_created_at_idx'),
        ('mutual_aid_comments_post_id_idx'),
        ('mutual_aid_likes_member_id_idx'),
        ('mutual_aid_saved_member_id_idx')
),
member_type_checks AS (
    SELECT
        'member_id_type_matches_members:' || tbl.table_name AS check_name,
        member_id_col.atttypid = members_id_col.atttypid
            AND member_id_col.atttypmod = members_id_col.atttypmod AS passed,
        'member_id=' || COALESCE(format_type(member_id_col.atttypid, member_id_col.atttypmod), 'missing')
            || ', members.id=' || COALESCE(format_type(members_id_col.atttypid, members_id_col.atttypmod), 'missing') AS detail
    FROM (VALUES
        ('mutual_aid_posts'),
        ('mutual_aid_comments'),
        ('mutual_aid_likes'),
        ('mutual_aid_saved')
    ) AS tbl(table_name)
    LEFT JOIN pg_attribute member_id_col
      ON member_id_col.attrelid = to_regclass('public.' || tbl.table_name)
     AND member_id_col.attname = 'member_id'
     AND NOT member_id_col.attisdropped
    LEFT JOIN pg_attribute members_id_col
      ON members_id_col.attrelid = to_regclass('public.members')
     AND members_id_col.attname = 'id'
     AND NOT members_id_col.attisdropped
)
SELECT 'table_exists:' || e.table_name AS check_name,
       to_regclass('public.' || e.table_name) IS NOT NULL AS passed,
       COALESCE(to_regclass('public.' || e.table_name)::text, 'missing') AS detail
FROM expected_tables e

UNION ALL

SELECT 'column:' || e.table_name || '.' || e.column_name AS check_name,
       a.actual_type = e.expected_type
           AND a.is_not_null = e.should_be_not_null
           AND (NOT e.should_be_identity OR a.is_identity) AS passed,
       'expected type=' || e.expected_type
           || ', actual type=' || COALESCE(a.actual_type, 'missing')
           || ', not_null=' || COALESCE(a.is_not_null::text, 'missing')
           || ', identity=' || COALESCE(a.is_identity::text, 'missing') AS detail
FROM expected_columns e
LEFT JOIN actual_columns a
  ON a.table_name = e.table_name
 AND a.column_name = e.column_name

UNION ALL

SELECT check_name, passed, detail
FROM member_type_checks

UNION ALL

SELECT 'primary_key:' || e.table_name AS check_name,
       a.actual_columns = e.expected_columns AS passed,
       'expected=' || e.expected_columns::text || ', actual=' || COALESCE(a.actual_columns::text, 'missing') AS detail
FROM expected_pks e
LEFT JOIN actual_pks a ON a.table_name = e.table_name

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
LEFT JOIN actual_fks a
  ON a.table_name = e.table_name
 AND a.constraint_name = e.constraint_name

UNION ALL

SELECT 'check_constraint:' || e.constraint_name AS check_name,
       con.oid IS NOT NULL AS passed,
       COALESCE(pg_get_constraintdef(con.oid), 'missing') AS detail
FROM expected_checks e
LEFT JOIN pg_constraint con
  ON con.conrelid = to_regclass('public.' || e.table_name)
 AND con.conname = e.constraint_name
 AND con.contype = 'c'

UNION ALL

SELECT 'index:' || e.index_name AS check_name,
       idx.indexname IS NOT NULL AS passed,
       COALESCE(idx.indexdef, 'missing') AS detail
FROM expected_indexes e
LEFT JOIN pg_indexes idx
  ON idx.schemaname = 'public'
 AND idx.indexname = e.index_name

UNION ALL

SELECT 'trigger:mutual_aid_posts_set_updated_at' AS check_name,
       EXISTS (
           SELECT 1
           FROM pg_trigger trg
           JOIN pg_proc proc ON proc.oid = trg.tgfoid
           WHERE trg.tgrelid = to_regclass('public.mutual_aid_posts')
             AND trg.tgname = 'mutual_aid_posts_set_updated_at'
             AND NOT trg.tgisinternal
             AND proc.proname = 'set_mutual_aid_posts_updated_at'
       ) AS passed,
       COALESCE((
           SELECT pg_get_triggerdef(trg.oid)
           FROM pg_trigger trg
           WHERE trg.tgrelid = to_regclass('public.mutual_aid_posts')
             AND trg.tgname = 'mutual_aid_posts_set_updated_at'
             AND NOT trg.tgisinternal
           LIMIT 1
       ), 'missing') AS detail

UNION ALL

SELECT 'trigger:no_like_count_trigger_on_likes' AS check_name,
       NOT EXISTS (
           SELECT 1
           FROM pg_trigger trg
           JOIN pg_proc proc ON proc.oid = trg.tgfoid
           WHERE trg.tgrelid = to_regclass('public.mutual_aid_likes')
             AND NOT trg.tgisinternal
             AND (
                 lower(pg_get_triggerdef(trg.oid)) LIKE '%like_count%'
                 OR lower(pg_get_functiondef(proc.oid)) LIKE '%like_count%'
             )
       ) AS passed,
       'No trigger on mutual_aid_likes should update mutual_aid_posts.like_count' AS detail

UNION ALL

SELECT 'foreign_key:no_auth_users_reference' AS check_name,
       NOT EXISTS (
           SELECT 1
           FROM pg_constraint con
           WHERE con.conrelid = ANY(ARRAY[
                 to_regclass('public.mutual_aid_posts'),
                 to_regclass('public.mutual_aid_comments'),
                 to_regclass('public.mutual_aid_likes'),
                 to_regclass('public.mutual_aid_saved')
             ])
             AND con.contype = 'f'
             AND con.confrelid = to_regclass('auth.users')
       ) AS passed,
       'mutual_aid_* foreign keys must reference public.members, not auth.users' AS detail

UNION ALL

SELECT 'table:no_public_profiles' AS check_name,
       to_regclass('public.profiles') IS NULL AS passed,
       COALESCE(to_regclass('public.profiles')::text, 'missing') AS detail

UNION ALL

SELECT 'rls:no_auth_uid_policy' AS check_name,
       NOT EXISTS (
           SELECT 1
           FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')
             AND (
                 COALESCE(qual, '') ILIKE '%auth.uid%'
                 OR COALESCE(with_check, '') ILIKE '%auth.uid%'
             )
       ) AS passed,
       'No mutual_aid_* policy should depend on auth.uid()' AS detail

UNION ALL

SELECT 'rls:enabled_without_force:' || cls.relname AS check_name,
       cls.relrowsecurity AND NOT cls.relforcerowsecurity AS passed,
       'rls_enabled=' || cls.relrowsecurity::text || ', rls_forced=' || cls.relforcerowsecurity::text AS detail
FROM pg_class cls
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')

UNION ALL

SELECT 'permissions:no_anon_authenticated_dml' AS check_name,
       NOT EXISTS (
           SELECT 1
           FROM information_schema.role_table_grants
           WHERE table_schema = 'public'
             AND table_name IN ('mutual_aid_posts', 'mutual_aid_comments', 'mutual_aid_likes', 'mutual_aid_saved')
             AND grantee IN ('anon', 'authenticated')
             AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       ) AS passed,
       'anon/authenticated should not have direct SELECT/INSERT/UPDATE/DELETE on mutual_aid_*' AS detail
ORDER BY check_name;

BEGIN;

CREATE TEMP TABLE verify_mutual_aid_integration_results (
    check_name text NOT NULL,
    passed boolean NOT NULL,
    detail text NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_member_id integer;
    v_post_id integer;
    v_comment_id integer;
    v_old_updated_at timestamp with time zone;
    v_new_updated_at timestamp with time zone;
    v_like_count integer;
    v_rows integer;
BEGIN
    SELECT id INTO v_member_id
    FROM public.members
    ORDER BY id
    LIMIT 1;

    IF v_member_id IS NULL THEN
        INSERT INTO verify_mutual_aid_integration_results
        VALUES ('integration:has_existing_member', FALSE, 'No public.members row available for rollback-only integration test');
        RETURN;
    END IF;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:has_existing_member', TRUE, 'Using one existing member id without exposing personal data');

    INSERT INTO public.mutual_aid_posts (
        member_id, type, content, farm_name, location_city, location_addr,
        location_lat, location_lng, images, updated_at
    )
    VALUES (
        v_member_id, '資訊分享', 'rollback-only mutual-aid schema test',
        'schema test farm', '台北市', 'schema test address',
        25.033, 121.5654, ARRAY['https://example.invalid/1.webp']::text[],
        now() - interval '1 hour'
    )
    RETURNING id, updated_at INTO v_post_id, v_old_updated_at;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:create_post', v_post_id IS NOT NULL, 'Created rollback-only post');

    INSERT INTO public.mutual_aid_comments (post_id, member_id, content)
    VALUES (v_post_id, v_member_id, 'rollback-only comment')
    RETURNING id INTO v_comment_id;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:create_comment', v_comment_id IS NOT NULL, 'Created rollback-only comment');

    INSERT INTO public.mutual_aid_likes (post_id, member_id)
    VALUES (v_post_id, v_member_id);

    SELECT like_count INTO v_like_count
    FROM public.mutual_aid_posts
    WHERE id = v_post_id;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:no_automatic_like_count_increment', v_like_count = 0, 'like_count after raw like insert=' || v_like_count::text);

    UPDATE public.mutual_aid_posts
    SET like_count = like_count + 1
    WHERE id = v_post_id
    RETURNING like_count INTO v_like_count;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:manual_like_increment_once', v_like_count = 1, 'like_count after backend-style increment=' || v_like_count::text);

    BEGIN
        INSERT INTO public.mutual_aid_likes (post_id, member_id)
        VALUES (v_post_id, v_member_id);

        INSERT INTO verify_mutual_aid_integration_results
        VALUES ('integration:duplicate_like_rejected', FALSE, 'Duplicate like insert unexpectedly succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verify_mutual_aid_integration_results
        VALUES ('integration:duplicate_like_rejected', TRUE, 'Composite primary key rejected duplicate like');
    END;

    DELETE FROM public.mutual_aid_likes
    WHERE post_id = v_post_id
      AND member_id = v_member_id;

    UPDATE public.mutual_aid_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = v_post_id
    RETURNING like_count INTO v_like_count;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:manual_like_decrement_once', v_like_count = 0, 'like_count after backend-style decrement=' || v_like_count::text);

    INSERT INTO public.mutual_aid_saved (post_id, member_id)
    VALUES (v_post_id, v_member_id);

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:create_saved', TRUE, 'Created rollback-only saved row');

    BEGIN
        INSERT INTO public.mutual_aid_saved (post_id, member_id)
        VALUES (v_post_id, v_member_id);

        INSERT INTO verify_mutual_aid_integration_results
        VALUES ('integration:duplicate_saved_rejected', FALSE, 'Duplicate saved insert unexpectedly succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verify_mutual_aid_integration_results
        VALUES ('integration:duplicate_saved_rejected', TRUE, 'Composite primary key rejected duplicate saved row');
    END;

    DELETE FROM public.mutual_aid_saved
    WHERE post_id = v_post_id
      AND member_id = v_member_id;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:delete_saved', NOT EXISTS (
        SELECT 1 FROM public.mutual_aid_saved WHERE post_id = v_post_id AND member_id = v_member_id
    ), 'Deleted rollback-only saved row');

    UPDATE public.mutual_aid_posts
    SET content = 'rollback-only mutual-aid schema test updated'
    WHERE id = v_post_id
    RETURNING updated_at INTO v_new_updated_at;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES (
        'integration:updated_at_trigger',
        v_new_updated_at > v_old_updated_at,
        'old=' || v_old_updated_at::text || ', new=' || v_new_updated_at::text
    );

    INSERT INTO public.mutual_aid_likes (post_id, member_id)
    VALUES (v_post_id, v_member_id);

    INSERT INTO public.mutual_aid_saved (post_id, member_id)
    VALUES (v_post_id, v_member_id);

    DELETE FROM public.mutual_aid_posts
    WHERE id = v_post_id;

    SELECT count(*) INTO v_rows
    FROM (
        SELECT 1 FROM public.mutual_aid_comments WHERE post_id = v_post_id
        UNION ALL
        SELECT 1 FROM public.mutual_aid_likes WHERE post_id = v_post_id
        UNION ALL
        SELECT 1 FROM public.mutual_aid_saved WHERE post_id = v_post_id
    ) leftovers;

    INSERT INTO verify_mutual_aid_integration_results
    VALUES ('integration:cascade_delete_children', v_rows = 0, 'child rows remaining after post delete=' || v_rows::text);
END;
$$;

SELECT check_name, passed, detail
FROM verify_mutual_aid_integration_results
ORDER BY check_name;

ROLLBACK;
