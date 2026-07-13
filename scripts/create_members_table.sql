-- 建立或對齊 members 與 user_preferences 資料表。
-- 本腳本可重複執行；若既有資料存在重複 Email 或孤立偏好資料，會停止並回報。

BEGIN;

CREATE TABLE IF NOT EXISTS public.members (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    plan          VARCHAR(50) NOT NULL DEFAULT '免費會員',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS id SERIAL,
    ADD COLUMN IF NOT EXISTS email VARCHAR(100),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT '免費會員',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.members
SET plan = '免費會員'
WHERE plan IS NULL;

UPDATE public.members
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.members
SET updated_at = NOW()
WHERE updated_at IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.members
        WHERE email IS NULL
           OR password_hash IS NULL
           OR name IS NULL
           OR plan IS NULL
           OR created_at IS NULL
           OR updated_at IS NULL
    ) THEN
        RAISE EXCEPTION 'members has NULL values in required columns; stop schema alignment';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.members
        GROUP BY email
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'members has duplicate email values; stop schema alignment';
    END IF;
END;
$$;

ALTER TABLE public.members
    ALTER COLUMN email SET NOT NULL,
    ALTER COLUMN password_hash SET NOT NULL,
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN plan SET DEFAULT '免費會員',
    ALTER COLUMN plan SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.members'::regclass
          AND contype = 'p'
    ) THEN
        ALTER TABLE public.members
            ADD CONSTRAINT members_pkey PRIMARY KEY (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.members'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
              (
                  SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = 'public.members'::regclass
                    AND attname = 'email'
                    AND NOT attisdropped
              )
          ]::smallint[]
    ) THEN
        ALTER TABLE public.members
            ADD CONSTRAINT members_email_unique UNIQUE (email);
    END IF;
END;
$$;

DO $$
DECLARE
    v_index_schema TEXT;
    v_index_name TEXT;
BEGIN
    FOR v_index_schema, v_index_name IN
        SELECT ns.nspname, cls.relname
        FROM pg_class cls
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        JOIN pg_index idx ON idx.indexrelid = cls.oid
        WHERE cls.relkind = 'i'
          AND ns.nspname = 'public'
          AND cls.relname = 'idx_members_email'
          AND idx.indisunique = FALSE
    LOOP
        EXECUTE FORMAT('DROP INDEX IF EXISTS %I.%I', v_index_schema, v_index_name);
    END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_preferences (
    member_id        INTEGER NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    price_alert      BOOLEAN NOT NULL DEFAULT TRUE,
    weather_alert    BOOLEAN NOT NULL DEFAULT TRUE,
    mutual_aid_reply BOOLEAN NOT NULL DEFAULT FALSE,
    font_size        TEXT NOT NULL DEFAULT 'md',
    layout_mode      TEXT NOT NULL DEFAULT 'simple',
    theme            TEXT NOT NULL DEFAULT 'light',
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS member_id INTEGER,
    ADD COLUMN IF NOT EXISTS price_alert BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS weather_alert BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS mutual_aid_reply BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'md',
    ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'simple',
    ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.user_preferences
SET price_alert = TRUE
WHERE price_alert IS NULL;

UPDATE public.user_preferences
SET weather_alert = TRUE
WHERE weather_alert IS NULL;

UPDATE public.user_preferences
SET mutual_aid_reply = FALSE
WHERE mutual_aid_reply IS NULL;

UPDATE public.user_preferences
SET font_size = 'md'
WHERE font_size IS NULL;

UPDATE public.user_preferences
SET layout_mode = 'simple'
WHERE layout_mode IS NULL;

UPDATE public.user_preferences
SET theme = 'light'
WHERE theme IS NULL;

UPDATE public.user_preferences
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.user_preferences
SET updated_at = NOW()
WHERE updated_at IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_preferences
        WHERE member_id IS NULL
           OR price_alert IS NULL
           OR weather_alert IS NULL
           OR mutual_aid_reply IS NULL
           OR font_size IS NULL
           OR layout_mode IS NULL
           OR theme IS NULL
           OR created_at IS NULL
           OR updated_at IS NULL
    ) THEN
        RAISE EXCEPTION 'user_preferences has NULL values in required columns; stop schema alignment';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_preferences preferences
        LEFT JOIN public.members members ON members.id = preferences.member_id
        WHERE members.id IS NULL
    ) THEN
        RAISE EXCEPTION 'user_preferences has orphan member_id values; stop schema alignment';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_preferences
        WHERE font_size NOT IN ('sm', 'md', 'lg')
           OR layout_mode NOT IN ('simple', 'detailed')
           OR theme NOT IN ('light', 'dark')
    ) THEN
        RAISE EXCEPTION 'user_preferences has values outside allowed preference options; stop schema alignment';
    END IF;
END;
$$;

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
    ALTER COLUMN theme SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_preferences'::regclass
          AND contype = 'f'
          AND conkey = ARRAY[
              (
                  SELECT attnum
                  FROM pg_attribute
                  WHERE attrelid = 'public.user_preferences'::regclass
                    AND attname = 'member_id'
                    AND NOT attisdropped
              )
          ]::smallint[]
          AND confrelid = 'public.members'::regclass
    ) THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_member_id_fkey
            FOREIGN KEY (member_id)
            REFERENCES public.members(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_preferences'::regclass
          AND conname = 'user_preferences_font_size_check'
    ) THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_font_size_check
            CHECK (font_size IN ('sm', 'md', 'lg'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_preferences'::regclass
          AND conname = 'user_preferences_layout_mode_check'
    ) THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_layout_mode_check
            CHECK (layout_mode IN ('simple', 'detailed'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_preferences'::regclass
          AND conname = 'user_preferences_theme_check'
    ) THEN
        ALTER TABLE public.user_preferences
            ADD CONSTRAINT user_preferences_theme_check
            CHECK (theme IN ('light', 'dark'));
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;
