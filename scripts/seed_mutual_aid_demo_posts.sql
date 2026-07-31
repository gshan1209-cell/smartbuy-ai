-- 互助網固定展示貼文。
-- 只使用既有 admin 會員，不建立帳號；以標題去重，不覆蓋既有貼文。

DO $$
DECLARE
    v_member_id integer;
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'members'
           AND column_name = 'role'
    ) THEN
        EXECUTE $sql$
            SELECT id
              FROM public.members
             WHERE role = 'admin'
             ORDER BY id
             LIMIT 1
        $sql$
        INTO v_member_id;
    ELSE
        -- 目前正式資料庫尚未套用 members.role migration；沿用既有管理員展示帳號。
        SELECT id
          INTO v_member_id
          FROM public.members
         WHERE name = 'admin'
         ORDER BY id
         LIMIT 1;
    END IF;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION '找不到既有 admin 會員，已停止新增互助展示貼文';
    END IF;

    INSERT INTO public.mutual_aid_posts (
        member_id, type, share_kind, location_city, location_addr,
        farm_name, title, content, website_url, images
    )
    SELECT
        v_member_id,
        seed.type,
        seed.share_kind,
        seed.location_city,
        seed.location_addr,
        seed.farm_name,
        seed.title,
        seed.content,
        NULL,
        ARRAY[seed.image_path]::text[]
    FROM (VALUES
        (
            '滯銷急售', 'special_offer', '台中市', '后里區', '后里綠田農場',
            '小白菜產地直送，兩把 50 元',
            '本週小白菜採收量較多，提供產地自取優惠。葉片新鮮，適合清炒或煮湯，兩把 50 元，數量有限，售完為止。需要預留的朋友可先留言告知數量與預計取貨時間。',
            '/images/community-demo/community-origin-sale-bokchoy.jpg'
        ),
        (
            '滯銷急售', 'product_recommendation', '台南市', '玉井區', '玉井日光果園',
            '當季愛文芒果家庭分享箱',
            '近期愛文芒果已進入適合品嘗的時期，推薦家庭分享箱。果實成熟度適中，香氣明顯，適合直接食用、製作果汁或搭配冰品。部分果實外觀可能有自然斑點，但不影響果肉品質。',
            '/images/community-demo/community-origin-recommend-mango.jpg'
        ),
        (
            '求助', 'special_offer', '台北市', '北投區', '北投社區共購站',
            '社區蔬菜箱滿 20 箱成團優惠',
            '正在募集本週社區蔬菜箱共購，內容包含葉菜、根菖類及當季蔬果。滿 20 箱即可使用團購價格，預計週六下午統一到貨並於社區門口領取。有興趣的住戶可留言登記箱數。',
            '/images/community-demo/community-coop-sale-vegetable-boxes.jpg'
        ),
        (
            '求助', 'product_recommendation', '新北市', '板橋區', '板橋惜食共煮社',
            '徵求夥伴共同使用格外品番茄',
            '近期有一批外觀不完整但品質正常的番茄，適合製作番茄紅醬、濃湯、燉菜或其他加工食品。希望尋找餐廳、社區共煮團體或加工夥伴共同分配使用，降低食材浪費。有需求者可留言說明所需數量。',
            '/images/community-demo/community-coop-recommend-tomatoes.jpg'
        ),
        (
            '資訊分享', 'special_offer', '高雄市', '美濃區', '美濃農情交流站',
            '週末白玉蘿蔔產季市集優惠',
            '本週末美濃產地市集將推出白玉蘿蔔產季優惠，現場可購買新鮮白玉蘿蔔及相關加工品。供應數量依當日採收情況為準，建議上午前往，以免熱門品項提早售完。',
            '/images/community-demo/community-info-sale-radish-market.jpg'
        ),
        (
            '資訊分享', 'product_recommendation', '嘉義縣', '民雄鄉', '嘉義農友交流站',
            '鳳梨挑選與保存方式分享',
            '挑選鳳梨時，可以觀察果皮色澤、果實重量及底部香氣。尚未切開的鳳梨可暫時放在陰涼通風處；切開後應裝入密封容器冷藏，並儘早食用。若香氣過重、果肉出水或出現異常發酵味，則不建議繼續食用。',
            '/images/community-demo/community-info-recommend-pineapple.jpg'
        )
    ) AS seed(type, share_kind, location_city, location_addr, farm_name, title, content, image_path)
    WHERE NOT EXISTS (
        SELECT 1
          FROM public.mutual_aid_posts existing
         WHERE existing.title = seed.title
    );
END;
$$;
