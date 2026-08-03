import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_HISTORY_TIMEOUT_MS,
  buildProductHistoryPath,
  loadProductHistory,
  selectProductHistoryRows,
} from '../src/lib/productHistory.js';

const rows = [
  { date: '2026-07-29', price: 20 },
  { date: '2026-07-30', price: 21 },
  { date: '2026-07-31', price: 22 },
];

test('history path keeps the selected market and requests a long enough window', () => {
  assert.equal(
    buildProductHistoryPath('芒果-金煌', '台中市'),
    '/api/products/%E8%8A%92%E6%9E%9C-%E9%87%91%E7%85%8C/history?days=180&market=%E5%8F%B0%E4%B8%AD%E5%B8%82',
  );
  assert.equal(PRODUCT_HISTORY_TIMEOUT_MS, 20_000);
});

test('history rows are filtered after a successful response', () => {
  assert.deepEqual(selectProductHistoryRows(rows, '2'), rows.slice(-2));
  assert.deepEqual(selectProductHistoryRows(rows, 'custom', '2026-07-30', '2026-07-31'), rows.slice(1));
});

test('history loader passes the extended timeout and preserves API errors', async () => {
  let request;
  const result = await loadProductHistory('芒果-金煌', '台中市', '7', '', '', {
    fetcher: async (path, options) => {
      request = { path, options };
      return { history: rows };
    },
  });

  assert.deepEqual(result, rows);
  assert.equal(request.options.timeoutMs, PRODUCT_HISTORY_TIMEOUT_MS);

  await assert.rejects(
    () => loadProductHistory('芒果-金煌', '台中市', '7', '', '', {
      fetcher: async () => { throw new Error('history timeout'); },
    }),
    /history timeout/,
  );
});
