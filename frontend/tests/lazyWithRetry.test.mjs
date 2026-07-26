import assert from 'node:assert/strict';
import test from 'node:test';

import { loadModuleWithRecovery } from '../src/lib/lazyWithRetry.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

const retryKey = key => `smartbuy:lazy-retry:${key}`;

test('successful import clears a previous retry flag', async () => {
  const storage = createStorage({ [retryKey('home')]: '1' });
  const loadedModule = { default: () => null };

  const result = await loadModuleWithRecovery(
    async () => loadedModule,
    'home',
    { storage, reload: () => assert.fail('reload should not run') },
  );

  assert.equal(result.status, 'loaded');
  assert.equal(result.module, loadedModule);
  assert.deepEqual(storage.snapshot(), {});
});

test('first stale chunk failure stores a retry flag and reloads once', async () => {
  const storage = createStorage();
  let reloadCount = 0;

  const result = await loadModuleWithRecovery(
    async () => { throw new Error('Failed to fetch dynamically imported module'); },
    'search',
    { storage, reload: () => { reloadCount += 1; } },
  );

  assert.equal(result.status, 'reloading');
  assert.equal(reloadCount, 1);
  assert.equal(storage.getItem(retryKey('search')), '1');
});

test('second stale chunk failure does not reload again and clears the flag', async () => {
  const storage = createStorage({ [retryKey('search')]: '1' });
  let reloadCount = 0;
  const error = new Error('ChunkLoadError: Loading chunk failed');

  const result = await loadModuleWithRecovery(
    async () => { throw error; },
    'search',
    { storage, reload: () => { reloadCount += 1; } },
  );

  assert.equal(result.status, 'error');
  assert.equal(result.error, error);
  assert.equal(reloadCount, 0);
  assert.deepEqual(storage.snapshot(), {});
});

test('non-chunk failures are surfaced without reloading', async () => {
  const storage = createStorage();
  let reloadCount = 0;
  const error = new Error('API response was invalid');

  const result = await loadModuleWithRecovery(
    async () => { throw error; },
    'points',
    { storage, reload: () => { reloadCount += 1; } },
  );

  assert.equal(result.status, 'error');
  assert.equal(result.error, error);
  assert.equal(reloadCount, 0);
});

test('automatic reload is disabled when retry state cannot be persisted', async () => {
  const unavailableStorage = {
    getItem() { throw new Error('storage disabled'); },
    setItem() { throw new Error('storage disabled'); },
    removeItem() { throw new Error('storage disabled'); },
  };
  let reloadCount = 0;

  const result = await loadModuleWithRecovery(
    async () => { throw new Error('Importing a module script failed'); },
    'dashboard',
    { storage: unavailableStorage, reload: () => { reloadCount += 1; } },
  );

  assert.equal(result.status, 'error');
  assert.equal(reloadCount, 0);
});
