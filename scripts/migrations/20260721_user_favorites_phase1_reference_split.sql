-- Phase 1: split public.user_favorites.ref_id into typed reference columns.
--
-- Keep public.user_favorites.type and public.user_favorites.ref_id for API and
-- deployed-code compatibility. The sync trigger below is temporary and should be
-- removed only in a later phase after all writers use the typed columns.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE type NOT IN ('news', 'product')
           OR type IS NULL
    ) THEN
        RAISE EXCEPTION 'BLOCKED: public.user_favorites contains unsupported type values';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE ref_id IS NULL
           OR btrim(ref_id) = ''
    ) THEN
        RAISE EXCEPTION 'BLOCKED: public.user_favorites contains NULL or blank ref_id values';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE type = 'news'
          AND (
              btrim(ref_id) !~ '^[0-9]+$'
              OR btrim(ref_id)::numeric > 9223372036854775807
          )
    ) THEN
        RAISE EXCEPTION 'BLOCKED: news favorites contain ref_id values that cannot be safely cast to bigint';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites favorites
        LEFT JOIN public.agri_news_articles articles
          ON articles.id = btrim(favorites.ref_id)::bigint
        WHERE favorites.type = 'news'
          AND articles.id IS NULL
    ) THEN
        RAISE EXCEPTION 'BLOCKED: news favorites contain orphan agri_news_articles references';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE type = 'product'
          AND btrim(ref_id) = ''
    ) THEN
        RAISE EXCEPTION 'BLOCKED: product favorites contain blank crop codes';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE type = 'news'
        GROUP BY member_id, ref_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'BLOCKED: duplicate news favorites exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_favorites
        WHERE type = 'product'
        GROUP BY member_id, btrim(ref_id)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'BLOCKED: duplicate product favorites exist after trimming ref_id';
    END IF;
END;
$$;

ALTER TABLE public.user_favorites
    ADD COLUMN IF NOT EXISTS news_article_id bigint,
    ADD COLUMN IF NOT EXISTS product_crop_code text;

UPDATE public.user_favorites
SET
    news_article_id = btrim(ref_id)::bigint,
    product_crop_code = NULL
WHERE type = 'news';

UPDATE public.user_favorites
SET
    news_article_id = NULL,
    product_crop_code = btrim(ref_id)
WHERE type = 'product';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_favorites'::regclass
          AND conname = 'user_favorites_news_article_id_fkey'
    ) THEN
        ALTER TABLE public.user_favorites
            ADD CONSTRAINT user_favorites_news_article_id_fkey
            FOREIGN KEY (news_article_id)
            REFERENCES public.agri_news_articles(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.user_favorites
    VALIDATE CONSTRAINT user_favorites_news_article_id_fkey;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_favorites'::regclass
          AND conname = 'user_favorites_reference_check'
    ) THEN
        ALTER TABLE public.user_favorites
            ADD CONSTRAINT user_favorites_reference_check
            CHECK (
                (
                    type = 'news'
                    AND news_article_id IS NOT NULL
                    AND product_crop_code IS NULL
                )
                OR
                (
                    type = 'product'
                    AND news_article_id IS NULL
                    AND product_crop_code IS NOT NULL
                    AND btrim(product_crop_code) <> ''
                )
            )
            NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.user_favorites
    VALIDATE CONSTRAINT user_favorites_reference_check;

CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_member_news_unique
    ON public.user_favorites (member_id, news_article_id)
    WHERE type = 'news';

CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_member_product_unique
    ON public.user_favorites (member_id, product_crop_code)
    WHERE type = 'product';

CREATE INDEX IF NOT EXISTS idx_user_favorites_news_article_id
    ON public.user_favorites (news_article_id)
    WHERE news_article_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_user_favorite_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type = 'news' THEN
        IF NEW.news_article_id IS NULL THEN
            IF NEW.ref_id IS NULL
               OR btrim(NEW.ref_id) !~ '^[0-9]+$'
               OR btrim(NEW.ref_id)::numeric > 9223372036854775807 THEN
                RAISE EXCEPTION 'news favorite ref_id must be a bigint integer'
                    USING ERRCODE = '22023';
            END IF;

            NEW.news_article_id := btrim(NEW.ref_id)::bigint;
        END IF;

        NEW.product_crop_code := NULL;
        NEW.ref_id := NEW.news_article_id::text;
    ELSIF NEW.type = 'product' THEN
        IF NEW.product_crop_code IS NULL THEN
            NEW.product_crop_code := btrim(COALESCE(NEW.ref_id, ''));
        ELSE
            NEW.product_crop_code := btrim(NEW.product_crop_code);
        END IF;

        IF NEW.product_crop_code = '' THEN
            RAISE EXCEPTION 'product favorite crop code must not be blank'
                USING ERRCODE = '22023';
        END IF;

        NEW.news_article_id := NULL;
        NEW.ref_id := NEW.product_crop_code;
    ELSE
        RAISE EXCEPTION 'unsupported user_favorites type: %', NEW.type
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_favorite_reference()
    IS 'Temporary Phase 1 compatibility trigger function. Remove in Phase 2 after all writers use typed reference columns.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.user_favorites'::regclass
          AND tgname = 'trg_user_favorites_sync_reference'
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER trg_user_favorites_sync_reference
            BEFORE INSERT OR UPDATE ON public.user_favorites
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_user_favorite_reference();
    END IF;
END;
$$;

COMMIT;
