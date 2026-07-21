-- Enforce exact one-to-one ownership between public.members and
-- public.user_preferences.
--
-- Rules:
-- - Every member has exactly one user_preferences row.
-- - New members receive default preferences automatically.
-- - A preferences row cannot be deleted while its member still exists.
-- - Deleting a member cascades to its preferences row.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_preferences preferences
        LEFT JOIN public.members members ON members.id = preferences.member_id
        WHERE members.id IS NULL
    ) THEN
        RAISE EXCEPTION 'BLOCKED: public.user_preferences contains orphan member_id values';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_preferences
        GROUP BY member_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'BLOCKED: public.user_preferences contains duplicate member_id values';
    END IF;
END;
$$;

INSERT INTO public.user_preferences (
    member_id,
    price_alert,
    weather_alert,
    mutual_aid_reply,
    font_size,
    layout_mode,
    theme
)
SELECT
    members.id,
    TRUE,
    TRUE,
    FALSE,
    'md',
    'simple',
    'light'
FROM public.members members
WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_preferences preferences
    WHERE preferences.member_id = members.id
);

ALTER TABLE public.user_preferences
    ALTER COLUMN member_id SET NOT NULL,
    ALTER COLUMN price_alert SET DEFAULT TRUE,
    ALTER COLUMN price_alert SET NOT NULL,
    ALTER COLUMN weather_alert SET DEFAULT TRUE,
    ALTER COLUMN weather_alert SET NOT NULL,
    ALTER COLUMN mutual_aid_reply SET DEFAULT FALSE,
    ALTER COLUMN mutual_aid_reply SET NOT NULL,
    ALTER COLUMN font_size SET DEFAULT 'md',
    ALTER COLUMN font_size SET NOT NULL,
    ALTER COLUMN layout_mode SET DEFAULT 'simple',
    ALTER COLUMN layout_mode SET NOT NULL,
    ALTER COLUMN theme SET DEFAULT 'light',
    ALTER COLUMN theme SET NOT NULL;

DO $$
DECLARE
    v_member_id_attnum smallint;
    v_primary_key_name text;
    v_primary_key_columns smallint[];
BEGIN
    SELECT attnum
      INTO v_member_id_attnum
    FROM pg_attribute
    WHERE attrelid = 'public.user_preferences'::regclass
      AND attname = 'member_id'
      AND NOT attisdropped;

    SELECT c.conname, c.conkey
      INTO v_primary_key_name, v_primary_key_columns
    FROM pg_constraint c
    WHERE c.conrelid = 'public.user_preferences'::regclass
      AND c.contype = 'p'
    ORDER BY c.conname
    LIMIT 1;

    IF v_primary_key_name IS NOT NULL
       AND v_primary_key_columns <> ARRAY[v_member_id_attnum]::smallint[] THEN
        RAISE EXCEPTION
            'BLOCKED: public.user_preferences has unexpected primary key constraint %',
            v_primary_key_name;
    END IF;

    IF v_primary_key_name IS NULL THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (member_id);
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_preferences'::regclass
          AND conname = 'user_preferences_member_id_unique'
          AND contype = 'u'
    ) THEN
        ALTER TABLE public.user_preferences
            DROP CONSTRAINT user_preferences_member_id_unique;
    END IF;
END;
$$;

DO $$
DECLARE
    v_fk_name text;
    v_fk_is_cascade boolean;
BEGIN
    SELECT c.conname,
           c.confdeltype = 'c'
      INTO v_fk_name, v_fk_is_cascade
    FROM pg_constraint c
    WHERE c.conrelid = 'public.user_preferences'::regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
          (
              SELECT attnum
              FROM pg_attribute
              WHERE attrelid = 'public.user_preferences'::regclass
                AND attname = 'member_id'
                AND NOT attisdropped
          )
      ]::smallint[]
      AND c.confrelid = 'public.members'::regclass
    ORDER BY c.conname
    LIMIT 1;

    IF v_fk_name IS NOT NULL AND NOT v_fk_is_cascade THEN
        EXECUTE format(
            'ALTER TABLE public.user_preferences DROP CONSTRAINT %I',
            v_fk_name
        );
        v_fk_name := NULL;
    END IF;

    IF v_fk_name IS NULL THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_member_id_fkey
            FOREIGN KEY (member_id)
            REFERENCES public.members(id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.user_preferences (
        member_id,
        price_alert,
        weather_alert,
        mutual_aid_reply,
        font_size,
        layout_mode,
        theme
    )
    VALUES (
        NEW.id,
        TRUE,
        TRUE,
        FALSE,
        'md',
        'simple',
        'light'
    )
    ON CONFLICT (member_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_create_default_user_preferences ON public.members;

CREATE TRIGGER trg_members_create_default_user_preferences
    AFTER INSERT ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_user_preferences();

CREATE OR REPLACE FUNCTION public.ensure_user_preferences_member_presence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_missing_member_id integer;
BEGIN
    v_missing_member_id := OLD.member_id;

    IF EXISTS (
        SELECT 1
        FROM public.members members
        WHERE members.id = v_missing_member_id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_preferences preferences
        WHERE preferences.member_id = v_missing_member_id
    ) THEN
        RAISE EXCEPTION
            'member % must retain exactly one user_preferences row',
            v_missing_member_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_preferences_require_member_pair ON public.user_preferences;

CREATE CONSTRAINT TRIGGER trg_user_preferences_require_member_pair
    AFTER DELETE OR UPDATE OF member_id ON public.user_preferences
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_user_preferences_member_presence();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.members members
        LEFT JOIN public.user_preferences preferences
          ON preferences.member_id = members.id
        WHERE preferences.member_id IS NULL
    ) THEN
        RAISE EXCEPTION 'BLOCKED: some members still lack user_preferences';
    END IF;
END;
$$;

COMMIT;
