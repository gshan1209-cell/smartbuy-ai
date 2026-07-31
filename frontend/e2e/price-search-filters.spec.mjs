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
