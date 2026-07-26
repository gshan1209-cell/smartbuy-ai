import { expect, test } from '@playwright/test';

import {
  ADMIN_PERMISSIONS,
  ADMIN_USER,
  installDeterministicNetwork,
  mockDashboardAccess,
  seedAuthenticatedUser,
} from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('管理員取得明確授權後可看到後台導覽', async ({ page }) => {
  await seedAuthenticatedUser(page, ADMIN_USER);
  await mockDashboardAccess(page, {
    permissions: ADMIN_PERMISSIONS,
    dashboardAccess: true,
  });

  await page.goto('/dashboard/overview');

  const navigation = page.getByRole('navigation', { name: '後台主要導覽' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: '總覽' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'AI 推薦' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '優惠券管理' })).toBeVisible();
  await expect(page.getByText('系統管理員')).toBeVisible();
});

test('後端明確拒絕時導向 403', async ({ page }) => {
  await seedAuthenticatedUser(page, { ...ADMIN_USER, role: 'consumer' });
  await mockDashboardAccess(page, { status: 403 });

  await page.goto('/dashboard/overview');

  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByRole('heading', { level: 1, name: '沒有權限查看這個頁面' })).toBeVisible();
});

test('權限服務不可用時保持 fail-closed 並提供重試', async ({ page }) => {
  await seedAuthenticatedUser(page, ADMIN_USER);

  await page.goto('/dashboard/overview');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('權限服務暫時無法取得，未開放任何後台內容。');
  await expect(alert.getByRole('button', { name: '重新確認權限' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '後台主要導覽' })).toHaveCount(0);
});
