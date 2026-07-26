const context = (title, sections, quickTags = [], description = '') => ({ title, sections, quickTags, description });

const link = (to, label, description) => ({ to, label, description });
const tag = (to, label, description) => ({ to, label, description });

export const PUBLIC_SIDEBAR_CONTEXTS = {
  '/': context('首頁工作台', [
    {
      heading: '首頁專屬入口',
      links: [
        link('/search', '進入查價', '前往菜價查詢頁'),
        link('/special-offers', '查看特賣', '前往限時限量特賣頁'),
      ],
    },
  ], [
    tag('/search?q=高麗菜', '高麗菜行情', '直接查詢高麗菜行情'),
    tag('/search?sort=price:asc', '低價優先', '直接查看低價品項'),
    tag('/search?filter=normal', '正常行情', '只查看資料完整的行情'),
  ]),
  '/search': context('行情查詢', [
    {
      heading: '查詢條件',
      links: [
        link('/search?filter=normal', '正常行情', '套用正常行情資料篩選'),
        link('/search?filter=資料不足', '資料不足', '查看資料不足的品項'),
        link('/search?sort=price:asc', '價格由低到高', '依目前價格由低到高排序'),
      ],
    },
  ], [
    tag('/search?q=番茄', '番茄', '直接查詢番茄行情'),
    tag('/search?q=高麗菜', '高麗菜', '直接查詢高麗菜行情'),
    tag('/search?q=香蕉', '香蕉', '直接查詢香蕉行情'),
    tag('/search', '全部縣市', '清除縣市條件並查看全部行情'),
  ]),
  '/product': context('商品詳情', [
    {
      heading: '查詢條件',
      links: [
        link('__current__?period=7', '近 7 天', '查看本商品近 7 天價格'),
        link('__current__?period=14', '近 14 天', '查看本商品近 14 天價格'),
        link('__current__?period=30', '近 30 天', '查看本商品近 30 天價格'),
      ],
    },
  ], [
    tag('__current__?period=custom', '自訂期間', '設定本商品自訂查詢期間'),
  ]),
  '/basket': context('我的收藏', [
    {
      heading: '收藏內容',
      links: [
        link('/basket#saved-products', '收藏品項', '查看收藏的農產品'),
        link('/basket#saved-news', '收藏文章', '查看收藏的農產文章'),
      ],
    },
  ]),
  '/news': context('農產新知', [
    {
      heading: '查詢條件',
      links: [
        link('/news', '全部文章', '清除條件並查看全部文章'),
      ],
    },
  ], [
    tag('/news?q=蔬菜', '蔬菜新知', '直接搜尋蔬菜相關文章'),
    tag('/news?q=水果', '水果新知', '直接搜尋水果相關文章'),
    tag('/news?source=農業部', '農業部來源', '只查看農業部來源文章'),
  ]),
  '/special-offers': context('好康推薦', [
    {
      heading: '查詢條件',
      links: [
        link('/special-offers?sort=savings', '省下比例排序', '依省下比例由高到低排列'),
        link('/special-offers?sort=price', '價格排序', '依目前價格由低到高排列'),
      ],
    },
  ], [
    tag('/special-offers?q=蔬菜', '蔬菜特賣', '直接搜尋蔬菜特賣'),
    tag('/special-offers?q=水果', '水果特賣', '直接搜尋水果特賣'),
    tag('/special-offers?q=即期', '即期特賣', '直接搜尋即期品特賣'),
  ]),
  '/information-sharing': context('資訊分享', [
    {
      heading: '查詢條件',
      links: [
        link('/information-sharing?type=資訊分享', '全部資訊', '查看資訊分享內容'),
        link('/information-sharing?share_kind=product_recommendation', '商品推薦', '查看商品推薦內容'),
      ],
    },
  ], [
    tag('/information-sharing?q=產地', '產地資訊', '搜尋產地相關分享'),
    tag('/information-sharing?q=採買', '採買交流', '搜尋採買相關分享'),
  ], '保留產地、栽培、產品與採購相關的實用資訊分享。'),
  '/mutual-aid': context('🎁 好康', [
    {
      heading: '查詢條件',
      links: [
        link('/mutual-aid?share_kind=product_recommendation', '好物推薦', '只查看好物推薦內容'),
        link('/mutual-aid?share_kind=special_offer', '特賣訊息', '只查看特賣訊息內容'),
      ],
    },
  ], [
    tag('/mutual-aid?q=即期', '即期好康', '搜尋即期品超低價推薦'),
    tag('/mutual-aid?q=高 CP 值', '高 CP 值', '搜尋高 CP 值好物推薦'),
    tag('/mutual-aid?city=全部', '全部縣市', '查看全部縣市推薦'),
  ], '產地特惠媒合、合作互助與栽培交流。'),
  '/points': context('點數與優惠券', [
    {
      heading: '點數頁專屬入口',
      links: [
        link('/points#available-coupons', '可兌換優惠券', '查看可兌換的優惠券'),
        link('/points#owned-coupons', '我的優惠券', '查看已兌換優惠券'),
        link('/points#point-history', '點數紀錄', '查看點數獲得與使用紀錄'),
      ],
    },
  ]),
  '/settings': context('帳號設定', [
    {
      heading: '設定頁專屬入口',
      links: [
        link('/settings#profile-settings', '個人資料', '編輯個人資料'),
        link('/settings#display-settings', '顯示設定', '設定主題與版面模式'),
        link('/settings#security-settings', '安全設定', '變更帳號密碼'),
      ],
    },
  ]),
  '/alerts': context('提醒中心', [
    {
      heading: '查詢條件',
      links: [
        link('/alerts?category=全部', '全部提醒', '查看全部提醒'),
        link('/alerts?category=互助網', '互動提醒', '查看互助網回覆與按讚提醒'),
      ],
    },
  ]),
  '/season': context('節氣指南', [
    {
      heading: '節氣頁專屬入口',
      links: [
        link('/season', '目前節氣', '查看目前節氣資訊'),
        link('/search', '當季行情', '前往查詢當季品項行情'),
      ],
    },
  ], [
    tag('/search?q=葉菜', '當季葉菜', '直接查詢當季葉菜行情'),
    tag('/search?q=水果', '當季水果', '直接查詢當季水果行情'),
  ]),
  '/login': context('會員登入', [
    {
      heading: '登入頁專屬入口',
      links: [link('/register', '註冊會員', '建立 SmartBuy AI 會員帳號')],
    },
  ]),
  '/register': context('加入會員', [
    {
      heading: '註冊頁專屬入口',
      links: [link('/login', '登入帳號', '登入既有會員帳號')],
    },
  ]),
};

export function getPublicSidebarContext(pathname) {
  if (PUBLIC_SIDEBAR_CONTEXTS[pathname]) return PUBLIC_SIDEBAR_CONTEXTS[pathname];
  if (pathname.startsWith('/product/')) return PUBLIC_SIDEBAR_CONTEXTS['/product'];
  return context('SmartBuy AI', [
    { heading: '目前頁面', links: [link(pathname, '重新整理本頁', '重新整理目前畫面')] },
  ]);
}
