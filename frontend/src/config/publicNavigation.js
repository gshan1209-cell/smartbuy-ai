export const POINTS_NAV_LINK = {
  to: '/points',
  label: '🪙 點數',
  description: '查看點數與優惠券',
};

export const SETTINGS_NAV_LINK = {
  to: '/settings',
  label: '⚙️ 設定',
  description: '管理帳戶設定',
};

export const DASHBOARD_NAV_LINK = {
  to: '/dashboard',
  label: '🛠️ 後台',
  description: '進入管理後台',
};

export const PUBLIC_NAV_LINKS = [
  { to: '/', label: '🏠 首頁', description: '回到首頁' },
  { to: '/recommendations', label: '✨ 推薦', description: '免登入取得 AI 採買推薦' },
  { to: '/search', label: '🥬 查價', description: '查詢農產品價格' },
  { to: '/basket', label: '🧺 菜籃', description: '查看我的菜籃' },
  POINTS_NAV_LINK,
  { to: '/news', label: '📰 新知', description: '閱讀農產新知與資訊分享' },
  { to: '/special-offers', label: '🏷️ 特賣', description: '瀏覽限時特賣' },
  { to: '/mutual-aid', label: '🎁 好康', description: '分享與發現好康' },
];

// 測試模式用單一主標題列檢視所有前台畫面；正式模式仍使用精簡導覽。
export const ALL_PUBLIC_NAV_LINKS = [
  ...PUBLIC_NAV_LINKS,
  { to: '/alerts', label: '🔔 提醒', description: '查看價格與互助網提醒' },
  { to: '/season', label: '🌾 節氣', description: '查看節氣與當季推薦' },
  SETTINGS_NAV_LINK,
];

export const PUBLIC_MOBILE_LINKS = [
  { to: '/recommendations', label: '✨ 推薦', description: '免登入取得 AI 採買推薦' },
  { to: '/news', label: '📰 新知', description: '閱讀農產新知與資訊分享' },
  { to: '/special-offers', label: '🏷️ 特賣', description: '瀏覽限時特賣' },
  { to: '/mutual-aid', label: '🎁 好康', description: '分享與發現好康' },
  POINTS_NAV_LINK,
  SETTINGS_NAV_LINK,
];
