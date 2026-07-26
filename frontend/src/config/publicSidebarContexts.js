const context = (title, sections) => ({ title, sections });

export const PUBLIC_SIDEBAR_CONTEXTS = {
  '/': context('首頁工作台', [
    {
      heading: '快速開始',
      links: [
        { to: '/search', label: '查行情', description: '查詢最新農產品行情' },
        { to: '/basket', label: '我的菜籃', description: '查看我的採買清單' },
        { to: '/special-offers', label: '看好康', description: '瀏覽限時限量特賣資訊' },
      ],
    },
    {
      heading: '生活資訊',
      links: [
        { to: '/news', label: '資訊分享', description: '閱讀農業與生活資訊' },
        { to: '/season', label: '節氣指南', description: '查看節氣與當季建議' },
      ],
    },
  ]),
  '/search': context('行情查詢', [
    {
      heading: '查價工具',
      links: [
        { to: '/search', label: '品項行情', description: '依品項、縣市查看行情' },
        { to: '/season', label: '當季採買', description: '查看當季蔬果建議' },
      ],
    },
    {
      heading: '延伸探索',
      links: [
        { to: '/special-offers', label: '比價好康', description: '前往限時特賣與好物推薦' },
        { to: '/basket', label: '加入菜籃', description: '整理想採買的品項' },
      ],
    },
  ]),
  '/product': context('商品資訊', [
    {
      heading: '商品操作',
      links: [
        { to: '/search', label: '返回查價', description: '返回行情查詢' },
        { to: '/basket', label: '我的菜籃', description: '查看我的採買清單' },
      ],
    },
    {
      heading: '相近內容',
      links: [
        { to: '/special-offers', label: '相關好康', description: '尋找相關特賣與推薦' },
        { to: '/news', label: '資訊分享', description: '閱讀相關農業資訊' },
      ],
    },
  ]),
  '/basket': context('我的菜籃', [
    {
      heading: '採買規劃',
      links: [
        { to: '/basket', label: '採買清單', description: '管理我的採買清單' },
        { to: '/search', label: '新增品項', description: '查行情並加入菜籃' },
      ],
    },
    {
      heading: '精打細算',
      links: [
        { to: '/special-offers', label: '限時好康', description: '查看限時限量優惠' },
        { to: '/points', label: '優惠券', description: '查看可兌換的優惠券' },
      ],
    },
  ]),
  '/news': context('資訊分享', [
    {
      heading: '內容分類',
      links: [
        { to: '/news', label: '農業資訊', description: '閱讀最新農業資訊' },
        { to: '/season', label: '節氣指南', description: '掌握節氣與當季內容' },
        { to: '/alerts', label: '我的提醒', description: '查看個人行情提醒' },
      ],
    },
    {
      heading: '一起分享',
      links: [
        { to: '/information-sharing', label: '分享資訊', description: '分享實用資訊給社群' },
        { to: '/mutual-aid', label: '推薦好物', description: '分享高 CP 值好物' },
      ],
    },
  ]),
  '/special-offers': context('好康推薦', [
    {
      heading: '優惠內容',
      links: [
        { to: '/special-offers', label: '特賣訊息', description: '瀏覽限時限量特賣' },
        { to: '/mutual-aid', label: '好物推薦', description: '查看大家推薦的高 CP 值好物' },
        { to: '/points', label: '我的優惠券', description: '查看已兌換的優惠券' },
      ],
    },
    {
      heading: '分享好康',
      links: [
        { to: '/mutual-aid', label: '發布推薦', description: '發布特賣或好物推薦' },
      ],
    },
  ]),
  '/information-sharing': context('資訊分享', [
    {
      heading: '分享主題',
      links: [
        { to: '/information-sharing', label: '資訊分享', description: '瀏覽資訊分享內容' },
        { to: '/news', label: '農業資訊', description: '閱讀官方與農業資訊' },
      ],
    },
    {
      heading: '探索好康',
      links: [
        { to: '/special-offers', label: '特賣訊息', description: '查看限時限量特賣' },
        { to: '/mutual-aid', label: '好物推薦', description: '查看高 CP 值商品推薦' },
      ],
    },
  ]),
  '/mutual-aid': context('好物推薦', [
    {
      heading: '推薦內容',
      links: [
        { to: '/mutual-aid', label: '好物推薦', description: '瀏覽社群推薦好物' },
        { to: '/special-offers', label: '特賣訊息', description: '瀏覽商家限時限量特賣' },
        { to: '/information-sharing', label: '資訊分享', description: '閱讀實用資訊分享' },
      ],
    },
    {
      heading: '我的回饋',
      links: [
        { to: '/points', label: '累積點數', description: '查看分享推薦獲得的點數' },
      ],
    },
  ]),
  '/points': context('點數與優惠券', [
    {
      heading: '會員回饋',
      links: [
        { to: '/points', label: '點數中心', description: '查看點數與兌換紀錄' },
        { to: '/mutual-aid', label: '推薦好物', description: '分享高 CP 值好物累積點數' },
      ],
    },
    {
      heading: '優惠使用',
      links: [
        { to: '/special-offers', label: '找優惠', description: '瀏覽可使用的特賣好康' },
        { to: '/basket', label: '採買清單', description: '回到我的採買清單' },
      ],
    },
  ]),
  '/settings': context('帳號設定', [
    {
      heading: '偏好設定',
      links: [
        { to: '/settings', label: '顯示設定', description: '設定主題與版面模式' },
        { to: '/points', label: '點數中心', description: '查看會員點數與優惠券' },
      ],
    },
    {
      heading: '返回使用',
      links: [
        { to: '/', label: '回到首頁', description: '返回 SmartBuy AI 首頁' },
        { to: '/search', label: '開始查價', description: '開始查詢農產品行情' },
      ],
    },
  ]),
  '/alerts': context('行情提醒', [
    {
      heading: '提醒管理',
      links: [
        { to: '/alerts', label: '我的提醒', description: '查看與管理行情提醒' },
        { to: '/search', label: '新增提醒', description: '從行情查詢建立提醒' },
      ],
    },
    {
      heading: '搭配使用',
      links: [
        { to: '/basket', label: '我的菜籃', description: '查看採買清單' },
        { to: '/news', label: '資訊分享', description: '閱讀最新資訊' },
      ],
    },
  ]),
  '/season': context('節氣指南', [
    {
      heading: '季節資訊',
      links: [
        { to: '/season', label: '節氣內容', description: '查看本期節氣資訊' },
        { to: '/search', label: '當季行情', description: '查詢當季品項行情' },
      ],
    },
    {
      heading: '延伸閱讀',
      links: [
        { to: '/news', label: '資訊分享', description: '閱讀農業與生活資訊' },
        { to: '/special-offers', label: '當季好康', description: '查看當季特賣推薦' },
      ],
    },
  ]),
  '/login': context('會員登入', [
    {
      heading: '會員服務',
      links: [
        { to: '/login', label: '登入帳號', description: '登入 SmartBuy AI' },
        { to: '/register', label: '註冊會員', description: '建立 SmartBuy AI 會員帳號' },
      ],
    },
  ]),
  '/register': context('加入會員', [
    {
      heading: '會員服務',
      links: [
        { to: '/register', label: '註冊會員', description: '建立 SmartBuy AI 會員帳號' },
        { to: '/login', label: '已有帳號', description: '登入既有會員帳號' },
      ],
    },
  ]),
};

export function getPublicSidebarContext(pathname) {
  if (PUBLIC_SIDEBAR_CONTEXTS[pathname]) return PUBLIC_SIDEBAR_CONTEXTS[pathname];
  if (pathname.startsWith('/product/')) return PUBLIC_SIDEBAR_CONTEXTS['/product'];
  return context('SmartBuy AI', [
    {
      heading: '探索 SmartBuy AI',
      links: [
        { to: '/', label: '回到首頁', description: '返回 SmartBuy AI 首頁' },
        { to: '/search', label: '開始查價', description: '開始查詢農產品行情' },
      ],
    },
  ]);
}
