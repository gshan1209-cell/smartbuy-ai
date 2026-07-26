import { expect, test } from '@playwright/test';

import { installDeterministicNetwork } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('首頁搜尋可完全用鍵盤操作', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: '今天買什麼？' })).toBeVisible();

  const searchInput = page.getByLabel('搜尋蔬菜或水果');
  await searchInput.fill('高麗菜');
  await searchInput.press('Enter');

  await expect(page).toHaveURL(/\/search\?q=%E9%AB%98%E9%BA%97%E8%8F%9C$/);
});

test('未知前台網址顯示可復原的 404', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');

  const notFoundCard = page.locator('.app-not-found-card');
  await expect(notFoundCard.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
  await expect(notFoundCard.getByText('/this-route-does-not-exist')).toBeVisible();
  await expect(notFoundCard.getByRole('link', { name: '回到首頁' })).toBeVisible();
});

test('匿名使用者進入後台會導向登入頁', async ({ page }) => {
  await page.goto('/dashboard/overview');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: '登入' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
});
