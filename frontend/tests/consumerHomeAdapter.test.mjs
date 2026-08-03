import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConsumerHome } from '../src/lib/consumerHomeAdapter.js';

test('consumer home keeps an empty live response empty instead of inventing demo prices', async () => {
  const result = await loadConsumerHome(async () => [], '');

  assert.deepEqual(result, { items: [], isDemo: false });
});

test('consumer home surfaces live API failures instead of falling back to static prices', async () => {
  await assert.rejects(
    () => loadConsumerHome(async () => { throw new Error('API unavailable'); }, ''),
    /即時行情資料/,
  );
});
