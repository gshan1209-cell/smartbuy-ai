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
    text: document.activeElement?.innerText?.trim(),
    ariaLabel: document.activeElement?.getAttribute('aria-label'),
  }));
  expect(focused.tag).not.toBe('BODY');
  expect(Boolean(focused.text || focused.ariaLabel)).toBe(true);
});

test('@responsive 首頁在地特色標題在手機版改為單欄排列', async ({ page }) => {
  await page.goto('/');

  const heading = page.locator('.local-explorer-heading');
  await expect(heading).toBeVisible();
  await expect(heading.locator('h3')).toContainText('在地特色農產');

  const layout = await heading.evaluate((element) => {
    const titleBlock = element.firstElementChild;
    const titleRect = titleBlock.getBoundingClientRect();
    const containerRect = element.getBoundingClientRect();

    return {
      flexDirection: window.getComputedStyle(element).flexDirection,
      titleWidth: titleRect.width,
      containerWidth: containerRect.width,
    };
  });

  expectNoHorizontalOverflow(await readViewportMetrics(page));

  if (page.viewportSize().width <= 767) {
    expect(layout.flexDirection).toBe('column');
    expect(layout.titleWidth).toBeGreaterThan(layout.containerWidth * 0.8);
  } else {
    expect(layout.flexDirection).toBe('row');
  }
});

test('@responsive 手機切換農產探索地區不應改變捲動位置', async ({ page }) => {
  const products = [
    { product_name: '梨-寶島甘露梨', today_price: 49.9, volume: 100, trans_date: '2026-08-02' },
    { product_name: '芒果-金煌', today_price: 61.1, volume: 90, trans_date: '2026-08-02' },
    { product_name: '酪梨', today_price: 45, volume: 80, trans_date: '2026-08-02' },
    { product_name: '木瓜-網室紅肉', today_price: 38, volume: 70, trans_date: '2026-08-02' },
  ];

  await page.route('**/api/markets', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ markets: ['台中市', '高雄市'] }),
  }));
  await page.route('**/api/products*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(products),
  }));
  await page.route('**/api/solar-term', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ term_name: '大暑' }),
  }));

  await page.goto('/');

  const regionButton = page.getByRole('radio', { name: '南部' });
  await expect(regionButton).toBeVisible();
  await regionButton.scrollIntoViewIfNeeded();

  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    window.__smartbuyScrollSamples = [{ at: 'before-click', y: window.scrollY }];
    window.__smartbuyScrollListener = () => {
      window.__smartbuyScrollSamples.push({ at: performance.now(), y: window.scrollY });
    };
    window.addEventListener('scroll', window.__smartbuyScrollListener, { passive: true });
  });
  if (page.viewportSize().width <= 767) await regionButton.tap();
  else await regionButton.click();
  await expect(page.locator('.local-explorer-heading h3')).toContainText('高雄市');
  await page.waitForTimeout(900);
  const scrollSamples = await page.evaluate(() => {
    window.removeEventListener('scroll', window.__smartbuyScrollListener);
    return window.__smartbuyScrollSamples;
  });
  const maxDisplacement = Math.max(
    ...scrollSamples.map(({ y }) => Math.abs(y - before)),
    0,
  );

  expect(maxDisplacement).toBeLessThan(40);
  expectNoHorizontalOverflow(await readViewportMetrics(page));
});

test('@responsive 404 在三種尺寸皆可閱讀與返回', async ({ page }) => {
  await page.goto('/missing-responsive-route');

  const notFoundCard = page.locator('.app-not-found-card');
  await expect(notFoundCard.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
  await expect(notFoundCard.getByRole('link', { name: '回到首頁' })).toBeVisible();
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

  if (testInfo.project.name === 'mobile-chromium') {
    const menuButton = page.getByRole('button', { name: '開啟後台選單' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
  }

  const visibleNavigation = page.locator('nav[aria-label="後台主要導覽"]:visible');
  await expect(visibleNavigation).toBeVisible();
  await expect(visibleNavigation.getByRole('link', { name: '總覽' })).toBeVisible();
});
