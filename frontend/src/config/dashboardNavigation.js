import { PERMISSIONS } from './permissions';
export const dashboardNavigation = [
  ['/dashboard/overview', '總覽', PERMISSIONS.dashboard], ['/dashboard/prices', '行情管理', PERMISSIONS.prices], ['/dashboard/products', '商品管理', PERMISSIONS.products], ['/dashboard/predictions', 'AI 預測', PERMISSIONS.predictions], ['/dashboard/weather', '天氣風險', PERMISSIONS.weather], ['/dashboard/seasonal', '節氣推薦', PERMISSIONS.seasonal], ['/dashboard/content', '內容管理', PERMISSIONS.content], ['/dashboard/mutual-aid', '互助網管理', PERMISSIONS.mutualAid], ['/dashboard/members', '會員管理', PERMISSIONS.members], ['/dashboard/notifications', '通知管理', PERMISSIONS.notifications], ['/dashboard/data-jobs', '資料任務', PERMISSIONS.dataJobs], ['/dashboard/settings', '系統設定', PERMISSIONS.system],
];
