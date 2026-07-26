const context = (title, sections, description = '', actions = []) => ({ title, sections, description, actions });

const link = (to, label, description) => ({ to, label, description });
const action = (name, label, description, icon = 'refresh') => ({ action: name, label, description, icon });

export const PUBLIC_SIDEBAR_CONTEXTS = {
  '/': context('首頁工作台', [
    {
      heading: '首頁專屬入口',
      links: [
        link('/search', '進入查價', '前往菜價查詢頁'),
        link('/special-offers', '查看特賣', '前往限時限量特賣頁'),
      ],
    },
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
  '/news': context('📰 農產新知', [
    {
      heading: '查詢條件',
      links: [
        link('/news', '全部文章', '清除條件並查看全部文章'),
      ],
    },
  ], '彙整農業部、各大媒體農業相關報導，掌握最新產銷動態。'),
  '/special-offers': context('🏷️ 特賣會', [
    {
      heading: '查詢條件',
      links: [
        link('/special-offers?sort=savings', '省下比例排序', '依省下比例由高到低排列'),
        link('/special-offers?sort=price', '價格排序', '依目前價格由低到高排列'),
      ],
    },
  ], '全站限時、限量特價資訊集中表列，所有好康一次看完。', [
    action('refresh-offers', '重新整理', '重新取得最新特賣資訊'),
  ]),
  '/information-sharing': context('資訊分享', [
    {
      heading: '查詢條件',
      links: [
        link('/information-sharing?type=資訊分享', '全部資訊', '查看資訊分享內容'),
        link('/information-sharing?share_kind=product_recommendation', '商品推薦', '查看商品推薦內容'),
      ],
    },
  ], '保留產地、栽培、產品與採購相關的實用資訊分享。'),
  '/mutual-aid': context('🎁 好康', [
    {
      heading: '查詢條件',
      links: [
        link('/mutual-aid?share_kind=product_recommendation', '好物推薦', '只查看好物推薦內容'),
        link('/mutual-aid?share_kind=special_offer', '特賣訊息', '只查看特賣訊息內容'),
        link('/mutual-aid?view=saved', '只看收藏', '只查看自己收藏的內容'),
        link('/mutual-aid?view=mine', '只看我的', '只查看自己發布的內容'),
      ],
    },
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
