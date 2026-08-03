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
  // Dev mode（API 路徑）mock：不在 production build 中生效，但保留作為保障
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
  await page.route(/\/api\/recommendations(\?|$)/, (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ detail: '推薦來源暫時無法使用，請稍後再試。' }),
  }));

  // Production build（static-cache 路徑）mock：Playwright 實際執行的是 vite preview，
  // VITE_RECOMMENDATION_SOURCE 預設為 'static-cache'，分類與市場從靜態 manifest 載入，
  // 推薦資料從靜態 JSON 檔案載入，完全不走 /api/recommendations。
  await page.route('**/recommendations-cache/v5/index.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [{ key: 'leafy-vegetables', label: '葉菜類', description: '當季葉菜' }],
      entries: [{ category: 'leafy-vegetables', market: '台北市場', region: 'north', filename: 'test-leafy-vegetables.json' }],
    }),
  }));
  await page.route('**/recommendations-cache/v5/test-leafy-vegetables.json', (route) => route.fulfill({
    status: 503,
  }));

  await page.goto('/');
  await page.getByRole('button', { name: /開啟 AI 推薦/ }).click();

  await expect(page).toHaveURL(/\/recommendations$/);
  await expect(page.locator('.public-sidebar-context-title')).toHaveText('AI 採買推薦');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('選擇行情分類與使用身分');
  await expect(page.getByRole('heading', { level: 1, name: '每日 AI 推薦快照' })).toBeVisible();
  await expect(page.locator('.recommendation-dashboard-shell')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /^消費者/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^農民/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^商家/ })).toBeVisible();
  await page.getByRole('radio', { name: /^農民/ }).click();
  await page.getByRole('button', { name: 'AI 推薦' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '登入' })).toHaveCount(0);
  await expect(page.locator('.daily-details-card')).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 1, name: '每日 AI 推薦快照' })).toBeVisible();
  await page.getByRole('button', { name: 'AI 推薦' }).click();
  await expect(page.locator('.daily-recommendation-result')).toBeVisible();
  await expect(page.locator('.daily-decision-grid')).toBeVisible();
  await page.locator('.daily-details-card > summary').click();
  await expect(page.locator('.daily-source-card')).toContainText('價格方向預測：有納入');
  await expect(page.locator('.daily-source-card')).toContainText('最近農業新知：有納入');
  await expect(page.locator('.daily-source-warnings')).toContainText('下一個交易日');
  await expect(page.locator('.daily-highlight-grid')).toContainText('優先採買');
  const viewport = await readViewportMetrics(page);
  expect(viewport.bodyScrollWidth).toBeLessThanOrEqual(viewport.viewportWidth);
});

test('新版角色化決策 JSON 只呈現四個決策重點 @responsive', async ({ page }) => {
  const document = {
    schema_version: 2,
    recommendation_date: '2026-07-31',
    generated_at: '2026-08-01T09:00:00+08:00',
    generator: { type: 'manual-chatgpt', api_called: false },
    market: { key: 'taipei-1', name: '台北一', region: '北部' },
    source_summary: {
      latest_trade_date: '2026-07-31',
      trade_data_age_days: 0,
      prediction_target_date: null,
      news_start_date: '2026-07-25',
      news_end_date: '2026-07-31',
      product_count: 22,
      includes_price_prediction: true,
      includes_recent_news: true,
      missing_sources: [],
      source_warnings: [],
    },
    market_summary: {
      headline: '供應量高的根菜與瓜果可優先比較。',
      overview: '完整市場分析放在詳細依據。',
      key_signals: ['蘿蔔平均價格較低且交易量高。'],
    },
    recommendations: {
      consumer: {
        role: 'consumer',
        role_label: '消費者',
        headline: '先買低價高量品項，高價品分批買。',
        decision: {
          primary: { label: '優先採買', items: ['蘿蔔-進口', '西瓜-大西瓜'], reason: '價格較低且交易量高。' },
          watch: ['零售價可能高於批發平均價。'],
          know: ['行情資料是批發市場平均價。'],
          do: ['先比較實際零售價。', '高價品項少量分批購買。'],
          evidence: ['蘿蔔-進口平均價格 12.8、交易量 31,840。'],
        },
      },
    },
  };
  await page.route('**/recommendations-daily/latest.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ schema_version: 2, markets: { 'taipei-1': 'v2/taipei-1.json' } }),
  }));
  await page.route('**/recommendations-daily/v2/taipei-1.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(document),
  }));

  await page.goto('/recommendations');
  await page.getByRole('button', { name: 'AI 推薦' }).click();
  await expect(page.locator('.daily-decision-grid')).toBeVisible();
  await expect(page.locator('.daily-decision-grid')).toContainText('優先採買');
  await expect(page.locator('.daily-decision-grid')).toContainText('要注意什麼');
  await expect(page.locator('.daily-decision-grid')).toContainText('必須知道什麼');
  await expect(page.locator('.daily-decision-grid')).toContainText('現在怎麼做');
  await expect(page.locator('.daily-details-card')).toContainText('查看完整判斷依據與資料來源');
  await expect(page.locator('.daily-recommendation-columns')).toHaveCount(0);
});

test('新知頁只保留農產新知內容 @responsive', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.public-header .brand')).toHaveCount(0);

  const viewport = page.viewportSize();
  if (viewport?.width <= 767) {
    await page.getByRole('button', { name: '開啟選單' }).click();
  }
  const contentCenterLink = viewport?.width <= 767
    ? page.getByRole('navigation', { name: '手機版主要選單' }).getByRole('link', { name: '閱讀農產新知與資訊分享' })
    : page.getByRole('link', { name: '閱讀農產新知與資訊分享' }).first();
  await expect(contentCenterLink).toBeVisible();
  await contentCenterLink.click();

  await expect(page).toHaveURL(/\/news$/);
  await expect(page.locator('.public-sidebar-context-title')).toHaveText('SmartBuy AI · 內容中心');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('農產新知');
  await expect(page.locator('.public-sidebar-context-description')).toContainText('掌握農產市場新知');
  await expect(page.getByRole('link', { name: '資訊分享', exact: true })).toHaveCount(0);
  await expect(page.locator('.content-hub-tabs')).toHaveCount(0);
  await expect(page.getByPlaceholder('搜尋標題或內容關鍵字...')).toBeVisible();

  await page.goto('/news?section=information-sharing');
  await expect(page.getByPlaceholder('搜尋標題或內容關鍵字...')).toBeVisible();
  await expect(page.locator('.ma-page')).toHaveCount(0);

  await page.goto('/information-sharing');
  await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
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

test('@responsive 菜籃收藏品項會帶入市場並可開啟商品詳情', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('smartbuy_saved_products', JSON.stringify(['西瓜-大西瓜']));
  });
  await page.route('**/api/products*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('q')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          product_name: '西瓜-大西瓜',
          market_name: '台中市',
          today_price: 49.9,
          status: '正常',
          trans_date: '2026-08-02',
        }]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        product_name: '西瓜-大西瓜',
        today_price: 49.9,
        price_status: '正常',
        price_detail: {
          market_name: '台中市',
          trans_date: '2026-08-02',
          status: '正常',
        },
      }),
    });
  });

  await page.goto('/basket');
  await expect(page.getByRole('heading', { level: 3, name: '西瓜-大西瓜' })).toBeVisible();
  await expect(page.getByText('49.9 元')).toBeVisible();
  await expect(page.getByText('台中市', { exact: true })).toBeVisible();

  const detailLink = page.getByRole('link', { name: '查看 西瓜-大西瓜 品項詳情' });
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/product\/.*market=%E5%8F%B0%E4%B8%AD%E5%B8%82/);
});
