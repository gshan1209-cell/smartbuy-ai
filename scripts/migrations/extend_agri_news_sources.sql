DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.agri_news_articles'::regclass
          AND conname = 'agri_news_articles_source_name_check'
          AND POSITION('btrim(source_name)' IN LOWER(pg_get_constraintdef(oid))) = 0
    ) THEN
        ALTER TABLE public.agri_news_articles
            DROP CONSTRAINT agri_news_articles_source_name_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.agri_news_articles'::regclass
          AND conname = 'agri_news_articles_source_name_check'
    ) THEN
        ALTER TABLE public.agri_news_articles
            ADD CONSTRAINT agri_news_articles_source_name_check
            CHECK (BTRIM(source_name) <> '');
    END IF;
END $$;
