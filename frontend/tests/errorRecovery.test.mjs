import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getErrorRecoveryContent,
  isChunkLoadError,
} from '../src/lib/errorRecovery.js';

test('known browser chunk errors are recognized', () => {
  const messages = [
    'ChunkLoadError: Loading chunk 123 failed',
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
  ];

  for (const message of messages) {
    assert.equal(isChunkLoadError(new Error(message)), true, message);
  }
});

test('ordinary application errors are not classified as chunk failures', () => {
  assert.equal(isChunkLoadError(new Error('Request returned 500')), false);
  assert.equal(isChunkLoadError(null), false);
});

test('chunk failures receive update-specific recovery copy', () => {
  assert.deepEqual(
    getErrorRecoveryContent(new Error('ChunkLoadError')),
    {
      title: '網站已更新，請重新載入',
      description: '目前分頁仍使用舊版資源，重新載入即可取得最新版本。',
    },
  );
});

test('generic recovery copy never echoes raw error details', () => {
  const secretLikeMessage = 'database password=do-not-display';
  const content = getErrorRecoveryContent(new Error(secretLikeMessage));

  assert.equal(content.title, '這個畫面暫時無法顯示');
  assert.equal(content.description.includes(secretLikeMessage), false);
  assert.equal(content.description.includes('password'), false);
});
