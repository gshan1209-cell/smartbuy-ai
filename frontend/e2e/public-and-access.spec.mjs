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
  const metrics = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          className: typeof element.className === 'string' ? element.className : null,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          position: style.position,
          overflowX: style.overflowX,
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewport + 1))
      .slice(0, 20);

    return {
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
      viewport,
      offenders,
    };
  });

  expect(
    Math.max(metrics.body, metrics.root),
    `Horizontal overflow diagnostics:\n${JSON.stringify(metrics, null, 2)}`,
  ).toBeLessThanOrEqual(metrics.viewport + 1);
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
  const notFound = page.locator('.app-not-found-card');
  await expect(notFound.getByRole('heading', { name: '找不到這個頁面' })).toBeVisible();
  await expect(notFound.getByText('/this-route-does-not-exist')).toBeVisible();
  await expect(notFound.getByRole('link', { name: '回到首頁', exact: true })).toBeVisible();
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

test('主要互動元件具有可辨識名稱', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.public-header .brand')).toHaveAccessibleName(/SmartBuy AI/);
  await expect(page.getByRole('group', { name: '版面模式' })).toBeVisible();

  const isMobile = testInfo.project.name.startsWith('mobile');
  if (isMobile) {
    await expect(page.getByRole('link', { name: '搜尋', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '開啟選單' })).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: '前往菜價查詢頁' })).toBeVisible();
  }
});
