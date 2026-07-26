import { expect, test } from '@playwright/test';

async function stubPublicApis(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/markets') {
      await route.fulfill({ json: { markets: ['台北一', '台中'] } });
      return;
    }
    if (path === '/api/solar-term') {
      await route.fulfill({ json: {} });
      return;
    }
    await route.fulfill({
      json: {
        items: [],
        prices: [],
        data: [],
        articles: [],
        total: 0,
      },
    });
  });
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(Math.max(metrics.body, metrics.root)).toBeLessThanOrEqual(metrics.viewport + 1);
}

test.beforeEach(async ({ page }) => {
  await stubPublicApis(page);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('首頁在三種尺寸皆可讀取且不產生水平溢位', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今天買什麼？' })).toBeVisible();
  await expect(page.getByLabel('搜尋蔬菜或水果')).toBeVisible();
  await expect(page.getByRole('button', { name: '查今天菜價' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('鍵盤可完成首頁查價流程', async ({ page }) => {
  await page.goto('/');
  const search = page.getByLabel('搜尋蔬菜或水果');
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill('高麗菜');
  await page.getByLabel('選擇市場').selectOption('台北一');
  await page.getByRole('button', { name: '查今天菜價' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=%E9%AB%98%E9%BA%97%E8%8F%9C&market=%E5%8F%B0%E5%8C%97%E4%B8%80/);
});

test('未知網址顯示可操作的 404 畫面', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: '找不到這個頁面' })).toBeVisible();
  await expect(page.getByText('/this-route-does-not-exist')).toBeVisible();
  await expect(page.getByRole('link', { name: '回到首頁' })).toBeVisible();
});

test('未登入進入 Dashboard 會導向登入頁且保留安全邊界', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('main')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Mobile 選單可用按鈕開啟並以 Escape 關閉', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), '只驗證 Mobile drawer');
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: '開啟選單' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole('navigation', { name: '手機版主要選單' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: '手機版主要選單' })).toBeHidden();
});

test('主要互動元件具有可辨識名稱', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /SmartBuy AI/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '搜尋' })).toBeVisible();
  await expect(page.getByRole('button', { name: '開啟選單' })).toBeVisible();
  await expect(page.getByRole('group', { name: '版面模式' })).toBeVisible();
});
