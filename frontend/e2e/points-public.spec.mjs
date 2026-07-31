import { expect, test } from '@playwright/test';

import { installDeterministicNetwork, readViewportMetrics } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('未登入可直接瀏覽點數展示資料且不呼叫會員 API @responsive', async ({ page }) => {
  const memberApiRequests = [];
  page.on('request', (request) => {
    if (/\/api\/(points|coupons(?:\/mine)?)/.test(request.url())) {
      memberApiRequests.push(request.url());
    }
  });

  await page.goto('/points');

  await expect(page).toHaveURL(/\/points$/);
  await expect(page.getByRole('heading', { level: 1, name: '點數中心' })).toBeVisible();
  await expect(page.getByText('展示資料', { exact: true })).toBeVisible();
  await expect(page.getByText('150', { exact: true })).toBeVisible();
  await expect(page.getByText('320', { exact: true })).toBeVisible();
  await expect(page.getByText('170', { exact: true })).toBeVisible();
  await expect(page.getByText('95 折優惠券', { exact: true })).toBeVisible();
  await expect(page.getByText('30 元折價券', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('80 元折價券', { exact: true })).toBeVisible();
  await expect(page.getByText('狀態：尚未使用', { exact: true })).toBeVisible();
  await expect(page.getByText('每日簽到', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('瀏覽特賣商品', { exact: true })).toBeVisible();
  await expect(page.getByText('分享商品', { exact: true })).toBeVisible();
  await expect(page.getByText('兌換 30 元折價券', { exact: true })).toBeVisible();
  await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  expect(memberApiRequests).toEqual([]);

  await page.getByRole('button', { name: '今日簽到' }).click();
  await expect(page.getByRole('button', { name: '今日已簽到' })).toBeDisabled();
  await expect(page.getByText('160', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '今日已簽到' })).toBeDisabled();
  await expect(page.getByText('160', { exact: true })).toBeVisible();

  const viewport = await readViewportMetrics(page);
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.viewportWidth);
});

test('已登入會員 API 失敗時切換展示資料而不顯示錯誤', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('yz_auth_user', JSON.stringify({
      id: 1001,
      name: '點數測試會員',
      email: 'points@example.test',
      role: 'consumer',
    }));
  });

  await page.goto('/points');

  await expect(page.getByText('展示資料', { exact: true })).toBeVisible();
  await expect(page.getByText('150', { exact: true })).toBeVisible();
  await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  await expect(page.getByText(/migration/i)).toHaveCount(0);
});

test('已登入且會員 API 成功時保留真實資料', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('yz_auth_user', JSON.stringify({
      id: 1002,
      name: '真實資料測試會員',
      email: 'real-points@example.test',
      role: 'consumer',
    }));
  });
  await page.route('**/api/admin/access', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ role: 'consumer', permissions: [], dashboardAccess: false }),
  }));
  await page.route('**/api/points', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ balance: 987, lifetime_earned: 1200, lifetime_spent: 213, transactions: [] }),
  }));
  await page.route('**/api/coupons', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 91, title: '會員專屬券', description: '真實 API 資料', points_cost: 80, discount_type: 'fixed', discount_value: 40, expires_at: '2026-11-30T15:59:59Z', owned: false }]),
  }));
  await page.route('**/api/coupons/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 92, title: '已領取會員券', description: '真實 API 資料', redemption_code: 'REAL-API-92', member_coupon_status: 'active', expires_at: '2026-11-30T15:59:59Z' }]),
  }));

  await page.goto('/points');

  await expect(page.getByText('987', { exact: true })).toBeVisible();
  await expect(page.getByText('會員專屬券', { exact: true })).toBeVisible();
  await expect(page.getByText('已領取會員券', { exact: true })).toBeVisible();
  await expect(page.getByText('展示資料', { exact: true })).toHaveCount(0);
});
