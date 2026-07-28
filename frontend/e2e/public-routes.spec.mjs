import { expect, test } from '@playwright/test';

import { installDeterministicNetwork, readViewportMetrics } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await installDeterministicNetwork(page);
});

test('首頁搜尋可完全用鍵盤操作', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: '今天買什麼？' })).toBeVisible();

  const heroBackground = await page.locator('.consumer-hero').evaluate((element) => (
    window.getComputedStyle(element).backgroundImage
  ));
  expect(heroBackground).toContain('special-offer-fruit-basket.png');

  const searchInput = page.getByLabel('搜尋蔬菜或水果');
  await searchInput.fill('高麗菜');
  await searchInput.press('Enter');

  await expect(page).toHaveURL(/\/search\?q=%E9%AB%98%E9%BA%97%E8%8F%9C$/);
});

test('訪客可由首頁直接開啟 AI 推薦，不會被導向登入', async ({ page }) => {
  await page.route('**/api/recommendations/categories', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [{ key: 'leafy-vegetables', label: '葉菜類', description: '當季葉菜' }],
    }),
  }));
  await page.route('**/api/markets', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ markets: ['台北市場'] }),
  }));
  await page.route('**/api/recommendations?category=leafy-vegetables&role=*&market=*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ detail: '推薦來源暫時無法使用，請稍後再試。' }),
  }));

  await page.goto('/');
  await page.getByRole('button', { name: /開啟 AI 推薦/ }).click();

  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(page.locator('.public-sidebar-context-title')).toHaveText('AI 採買推薦');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('選擇行情分類與使用身分');
  await expect(page.getByRole('heading', { level: 1, name: '推薦控制台' })).toBeVisible();
  await expect(page.locator('.recommendation-dashboard-shell')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '消費者' })).toBeVisible();
  await expect(page.getByRole('button', { name: '農民' })).toBeVisible();
  await expect(page.getByRole('button', { name: '商家' })).toBeVisible();
  await page.getByRole('button', { name: '農民' }).click();
  await page.getByLabel('推薦市場').selectOption('台北市場');
  await page.getByLabel('推薦分類').selectOption('leafy-vegetables');
  await page.getByRole('button', { name: 'AI推薦' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '登入' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('推薦來源暫時無法使用');
});

test('推薦結果呈現淺色儀表板與資料狀態 @responsive', async ({ page }) => {
  const roleContent = (role, label) => ({
    role,
    role_label: label,
    perspective: `${label}端`,
    summary: '根據目前資料整理行動方向。',
    market_outlook: '目前行情維持觀察，建議搭配市場條件判讀。',
    shopping_strategy: '先比較價格與替代品，再安排採買。',
    items: [{
      product_name: '高麗菜',
      market_name: '台北市場',
      price_status: '便宜',
      today_price: 30,
      recent_average: 42,
      action: '可優先採買',
      reason: '低於近期平均。',
      priority: 'high',
      substitute: '白菜',
    }],
  });
  const consumer = roleContent('consumer', '消費者');
  const farmer = roleContent('farmer', '農民');
  const merchant = roleContent('merchant', '商家');
  const recommendation = {
    category: 'leafy-vegetables',
    cache_hit: true,
    llm_called: false,
    cache_backend: 'json',
    generation_source: 'llm',
    generated_at: '2026-07-28T03:00:00Z',
    data_status: 'official',
    source_name: '農業部批發市場行情',
    selected_role: 'consumer',
    selected_recommendation: consumer,
    data: {
      category: { key: 'leafy-vegetables', label: '葉菜類', description: '當季葉菜' },
      generated_at: '2026-07-28T03:00:00Z',
      generator: 'llm',
      source_summary: {
        candidate_count: 5,
        latest_trade_date: '2026-07-27',
        historical_data: false,
        data_status: 'official',
        source_name: '農業部批發市場行情',
      },
      role_recommendations: { consumer, farmer, merchant },
    },
    role_recommendations: { consumer, farmer, merchant },
    recommendations: consumer.items,
  };

  await page.route('**/api/recommendations**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(recommendation),
  }));
  await page.route('**/api/recommendations/categories**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [{ key: 'leafy-vegetables', label: '葉菜類', description: '當季葉菜' }],
    }),
  }));
  await page.route('**/api/markets', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ markets: ['台北市場'] }),
  }));

  await page.goto('/recommendations');
  await page.getByLabel('推薦市場').selectOption('台北市場');
  await page.getByLabel('推薦分類').selectOption('leafy-vegetables');
  await page.getByRole('button', { name: 'AI推薦' }).click();

  await expect(page.getByRole('heading', { name: '葉菜類採買與行動總覽' })).toBeVisible();
  await expect(page.locator('.recommendation-dashboard-kpi')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: '價格狀態分布' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '市場趨勢' })).toBeVisible();
  await expect(page.locator('.recommendation-dashboard-insight')).toHaveCount(4);
  const viewport = await readViewportMetrics(page);
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.viewportWidth);
});

test('主標題列將農產新知與資訊分享合併為同一個內容中心', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.public-header .brand')).toHaveCount(0);

  const contentCenterLink = page.getByRole('link', { name: '閱讀農產新知與資訊分享' }).first();
  await expect(contentCenterLink).toBeVisible();
  await contentCenterLink.click();

  await expect(page).toHaveURL(/\/news$/);
  await expect(page.locator('.public-sidebar-context-title')).toHaveText('SmartBuy AI · 內容中心');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('新知與資訊分享');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('掌握農產市場新知');
  await expect(page.getByRole('link', { name: '📣 資訊分享' })).toBeVisible();

  await page.getByRole('link', { name: '📣 資訊分享' }).click();
  await expect(page).toHaveURL(/\/news\?section=information-sharing$/);
  await expect(page.locator('.public-sidebar-context-title')).toHaveText('SmartBuy AI · 內容中心');
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
