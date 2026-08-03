import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASKET_PRODUCTS_TIMEOUT_MS,
  loadBasketProductDetails,
  selectFavoriteProduct,
} from '../src/lib/basketProducts.js';

const products = [
  { product_name: '西瓜-大西瓜', market_name: '台中市', today_price: 17.5 },
  { product_name: '西瓜-大西瓜', market_name: '台北一', today_price: 20.1 },
];

test('菜籃優先顯示收藏時的市場，舊收藏則使用目前可用市場', () => {
  assert.equal(
    selectFavoriteProduct({ name: '西瓜-大西瓜', market: '台北一' }, products).today_price,
    20.1,
  );
  assert.equal(
    selectFavoriteProduct({ name: '西瓜-大西瓜', market: '' }, products).market_name,
    '台中市',
  );
});

test('菜籃只載入一次行情清單並使用延長後的逾時', async () => {
  const requests = [];
  const details = await loadBasketProductDetails(
    [{ name: '西瓜-大西瓜', market: '' }],
    { fetcher: async (path, options) => {
      requests.push({ path, options });
      return products;
    } },
  );

  assert.deepEqual(requests, [{
    path: '/api/products',
    options: { timeoutMs: BASKET_PRODUCTS_TIMEOUT_MS },
  }]);
  assert.equal(details['西瓜-大西瓜'].dataState, 'ready');
  assert.equal(details['西瓜-大西瓜'].today_price, 17.5);
});

test('行情請求失敗與真正查無品項使用不同狀態', async () => {
  const favorites = [{ name: '西瓜-大西瓜', market: '' }];
  const unavailable = await loadBasketProductDetails(favorites, {
    fetcher: async () => { throw new Error('temporary failure'); },
  });
  const missing = await loadBasketProductDetails(favorites, {
    fetcher: async () => [],
  });

  assert.equal(unavailable['西瓜-大西瓜'].dataState, 'unavailable');
  assert.equal(missing['西瓜-大西瓜'].dataState, 'missing');
});
