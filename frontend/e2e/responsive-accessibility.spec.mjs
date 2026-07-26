import { expect, test } from '@playwright/test';

import {
  ADMIN_PERMISSIONS,
  ADMIN_USER,
  installDeterministicNetwork,
  mockDashboardAccess,
  readFocusableNameProblems,
  readViewportMetrics,
  seedAuthenticatedUser,
} from './helpers.mjs';

function expectNoHorizontalOverflow(metrics) {
  const widest = Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth);
  expect(widest).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('@responsive 首頁在三種尺寸皆無水平溢出且控制項有名稱', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '今天買什麼？' })).toBeVisible();

  expectNoHorizontalOverflow(await readViewportMetrics(page));
  expect(await readFocusableNameProblems(page)).toEqual([]);

  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim(),
    ariaLabel: document.activeElement?.getAttribute('aria-label'),
  }));
  expect(focused.tag).not.toBe('BODY');
  expect(Boolean(focused.text || focused.ariaLabel)).toBe(true);
});

test('@responsive 404 在三種尺寸皆可閱讀與返回', async ({ page }) => {
  await page.goto('/missing-responsive-route');

  await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
  await expect(page.getByRole('link', { name: '回到首頁' })).toBeVisible();
  expectNoHorizontalOverflow(await readViewportMetrics(page));
  expect(await readFocusableNameProblems(page)).toEqual([]);
});

test('@responsive 後台外殼在三種尺寸維持可操作', async ({ page }, testInfo) => {
  await seedAuthenticatedUser(page, ADMIN_USER);
  await mockDashboardAccess(page, {
    permissions: ADMIN_PERMISSIONS,
    dashboardAccess: true,
  });

  await page.goto('/dashboard/overview');
  await expect(page.getByText('管理中心 / Dashboard')).toBeVisible();
  expectNoHorizontalOverflow(await readViewportMetrics(page));
  expect(await readFocusableNameProblems(page)).toEqual([]);

  if (testInfo.project.name !== 'desktop-chromium') {
    const menuButton = page.getByRole('button', { name: '開啟後台選單' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole('navigation', { name: '後台主要導覽' })).toBeVisible();
  }
});
