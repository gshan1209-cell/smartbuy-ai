// 開發環境只放寬前端導覽與畫面檢視，正式建置不會啟用。
export const BYPASS_ROLE_CHECKS_IN_DEV = import.meta.env.DEV;

export const DEV_DEFAULT_USER = Object.freeze({
  id: 'dev-admin',
  email: 'admin@smartbuy.local',
  name: '開發管理員',
  role: 'admin',
});
