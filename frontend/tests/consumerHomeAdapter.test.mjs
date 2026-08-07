import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_PRODUCTS_TIMEOUT_MS,
  loadConsumerHome,
} from '../src/lib/consumerHomeAdapter.js';

test('consumer home keeps an empty live response empty instead of inventing demo prices', async () => {
  const requests = [];
  const result = await loadConsumerHome(async (path, options) => {
    requests.push({ path, options });
    return [];
  }, '');

  assert.deepEqual(result, { items: [], isDemo: false });
  assert.deepEqual(requests, [{
    path: '/api/products',
    options: { timeoutMs: HOME_PRODUCTS_TIMEOUT_MS },
  }]);
});

test('consumer home surfaces live API failures instead of falling back to static prices', async () => {
  await assert.rejects(
    () => loadConsumerHome(async () => { throw new Error('API unavailable'); }, ''),
    /即時行情資料/,
  );
});
