-- Add the two public information-share card types and the merchant website link.
-- Existing posts remain valid and are treated as product recommendations.

ALTER TABLE public.mutual_aid_posts
    ADD COLUMN IF NOT EXISTS share_kind text,
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS website_url text;

UPDATE public.mutual_aid_posts
SET share_kind = 'product_recommendation'
WHERE type = '資訊分享' AND share_kind IS NULL;

ALTER TABLE public.mutual_aid_posts
    DROP CONSTRAINT IF EXISTS mutual_aid_posts_share_kind_check;

ALTER TABLE public.mutual_aid_posts
    ADD CONSTRAINT mutual_aid_posts_share_kind_check
    CHECK (share_kind IS NULL OR share_kind IN ('special_offer', 'product_recommendation'));

ALTER TABLE public.mutual_aid_posts
    DROP CONSTRAINT IF EXISTS mutual_aid_posts_website_url_check;

ALTER TABLE public.mutual_aid_posts
    ADD CONSTRAINT mutual_aid_posts_website_url_check
    CHECK (website_url IS NULL OR website_url ~ '^https?://');
