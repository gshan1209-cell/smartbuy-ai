import { expect, test } from '@playwright/test';
import { installDeterministicNetwork, readViewportMetrics } from './helpers.mjs';

const products = [
  { product_name: '甘藍', market_name: '台北一', today_price: 20, volume: 10, status: '便宜' },
  { product_name: '甘藍', market_name: '台中市', today_price: 80, volume: 90, status: '偏貴' },
  { product_name: '番茄', market_name: '台北一', today_price: 50, volume: 50, status: '正常' },
  { product_name: '小白菜', market_name: '台中市', today_price: 35, volume: 30, status: '便宜' },
];

async function mockPriceSearch(page) {
  await installDeterministicNetwork(page);
  await page.route('**/api/markets', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ markets: ['台北一', '台中市'] }),
  }));
  await page.route('**/api/products*', (route) => {
    const market = new URL(route.request().url()).searchParams.get('market');
    const payload = market
      ? products.filter((item) => item.market_name === market)
      : products;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
  await page.route('**/api/products/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/history')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: [] }),
      });
    }
    const market = url.searchParams.get('market');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        today_price: 50,
        price_status: '正常',
        price_detail: { market_name: market },
      }),
    });
  });
}

async function cardSummary(page) {
  return page.locator('.price-result-card').evaluateAll((cards) => cards.map((card) => ({
    name: card.querySelector('h3')?.textContent,
    market: card.querySelector('.result-card-head small')?.textContent,
    price: card.querySelector('.result-price > span')?.textContent,
    status: card.querySelector('.result-status')?.textContent?.trim(),
  })));
}

test('全部市場可組合價格範圍、排序及價格狀態，特定市場仍正常', async ({ page }) => {
  await mockPriceSearch(page);
  await page.goto('/search');
  await expect(page.locator('.price-result-card')).toHaveCount(4);

  const minimum = page.getByLabel('最低價格');
  const maximum = page.getByLabel('最高價格');
  await minimum.fill('30');
  await maximum.fill('60');
  await expect(page.locator('.price-result-card')).toHaveCount(2);
  expect((await cardSummary(page)).map((item) => item.price)).toEqual(['50 元', '35 元']);

  await page.locator('.desktop-filters select').nth(1).selectOption('price:asc');
  expect((await cardSummary(page)).map((item) => item.price)).toEqual(['35 元', '50 元']);

  await page.getByRole('button', { name: '便宜', exact: true }).click();
  expect(await cardSummary(page)).toEqual([{
    name: '小白菜', market: '台中市', price: '35 元', status: '便宜',
  }]);

  await maximum.fill('100');
  await page.getByRole('button', { name: '全部', exact: true }).click();
  expect((await cardSummary(page)).map((item) => item.price)).toEqual(['35 元', '50 元', '80 元']);

  await minimum.fill('0');
  await page.locator('.desktop-filters select').first().selectOption('台北一');
  await expect(page.locator('.price-result-card')).toHaveCount(2);
  expect((await cardSummary(page)).map((item) => [item.market, item.price])).toEqual([
    ['台北一', '20 元'],
    ['台北一', '50 元'],
  ]);
});

test('@responsive 查價欄位及版型維持可用，進階市場資訊已移除', async ({ page }) => {
  await mockPriceSearch(page);
  await page.goto('/search');
  await expect(page.getByPlaceholder('例如：甘藍')).toBeVisible();
  await expect(page.getByText('進階市場資訊', { exact: true })).toHaveCount(0);
  const metrics = await readViewportMetrics(page);
  expect(Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth)).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );
});

test('全部市場的同品項卡片分別帶入自身市場，詳情重新整理及回列表正常', async ({ page }) => {
  await mockPriceSearch(page);
  await page.goto('/search');

  const card = page.locator('.price-result-card').filter({ hasText: '甘藍台中市' });
  const detailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return decodeURIComponent(url.pathname).endsWith('/api/products/甘藍')
      && url.searchParams.get('market') === '台中市';
  });
  await card.getByRole('button', { name: '查看詳情' }).click();
  await detailRequest;

  await expect(page).toHaveURL(/\/product\/%E7%94%98%E8%97%8D\?market=%E5%8F%B0%E4%B8%AD%E5%B8%82$/);
  await expect(page.getByText('台中市 ·', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('無法取得詳細資料')).toHaveCount(0);
  await page.getByRole('button', { name: '回到列表' }).click();
  await expect(page).toHaveURL(/\/search\?market=%E5%8F%B0%E4%B8%AD%E5%B8%82$/);

  await page.goto('/search');
  const otherMarketRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return decodeURIComponent(url.pathname).endsWith('/api/products/甘藍')
      && url.searchParams.get('market') === '台北一';
  });
  await page.locator('.price-result-card').filter({ hasText: '甘藍台北一' })
    .getByRole('button', { name: '查看詳情' }).click();
  await otherMarketRequest;
  await expect(page.getByText('台北一 ·', { exact: false })).toBeVisible();
});

test('個別市場卡片維持帶入原市場', async ({ page }) => {
  await mockPriceSearch(page);
  await page.goto('/search?market=台北一');

  const detailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return decodeURIComponent(url.pathname).endsWith('/api/products/番茄')
      && url.searchParams.get('market') === '台北一';
  });
  await page.locator('.price-result-card').filter({ hasText: '番茄台北一' })
    .getByRole('button', { name: '查看詳情' }).click();
  await detailRequest;

  await expect(page).toHaveURL(/\/product\/%E7%95%AA%E8%8C%84\?market=%E5%8F%B0%E5%8C%97%E4%B8%80$/);
  await expect(page.getByText('台北一 ·', { exact: false })).toBeVisible();
});

test('@responsive 商品詳情在手機版堆疊摘要，圖表控制項不溢位', async ({ page }) => {
  await mockPriceSearch(page);
  await page.goto('/product/甘藍?market=台中市');

  await expect(page.getByRole('heading', { name: '甘藍 · 折線圖' })).toBeVisible();
  await expect(page.getByRole('button', { name: /平板/ })).toHaveCount(0);
  await expect(page.locator('.product-detail-chart-actions')).toBeVisible();

  const metrics = await readViewportMetrics(page);
  expect(Math.max(metrics.bodyScrollWidth, metrics.documentScrollWidth)).toBeLessThanOrEqual(
    metrics.viewportWidth + 1,
  );

  if (page.viewportSize().width <= 767) {
    const metricColumns = await page.locator('.product-detail-metrics').evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/),
    );
    expect(metricColumns).toHaveLength(1);
  }
});
