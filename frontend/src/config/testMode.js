import { PERMISSIONS } from './permissions';

// 測試模式只允許在 Vite 開發伺服器明確開啟，正式 build 永遠不會繞過登入與 RBAC。
export const IS_TEST_MODE = import.meta.env.DEV
  && import.meta.env.VITE_ENABLE_TEST_MODE === 'true';

export const TEST_USER = Object.freeze({
  id: 0,
  name: '測試使用者',
  email: 'test-user@example.test',
  role: 'admin',
});

export const TEST_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));
