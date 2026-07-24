import { PERMISSIONS } from './permissions';

export const DASHBOARD_PLACEHOLDER_MODULES = Object.freeze({
  products: { title: '商品管理', permission: PERMISSIONS.PRODUCTS_VIEW },
  content: { title: '內容管理', permission: PERMISSIONS.CONTENT_MANAGE },
  'mutual-aid': { title: '互助網管理', permission: PERMISSIONS.MUTUAL_AID_MANAGE },
  members: { title: '會員管理', permission: PERMISSIONS.MEMBERS_MANAGE },
  notifications: { title: '通知管理', permission: PERMISSIONS.NOTIFICATIONS_MANAGE },
  'data-jobs': { title: '資料任務監控', permission: PERMISSIONS.DATA_JOBS_VIEW },
  settings: { title: '系統設定', permission: PERMISSIONS.SYSTEM_MANAGE },
});
