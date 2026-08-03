import assert from 'node:assert/strict';
import test from 'node:test';

import { LAYOUT_MODE_OPTIONS, normalizeLayoutMode } from '../src/hooks/useLayoutMode.js';

test('manual layout switch only exposes desktop and mobile', () => {
  assert.deepEqual(
    LAYOUT_MODE_OPTIONS.map(option => option.value),
    ['desktop', 'mobile'],
  );
});

test('legacy tablet preference is converted to the current screen mode', () => {
  const previousWindow = globalThis.window;

  globalThis.window = { innerWidth: 390 };
  assert.equal(normalizeLayoutMode('tablet'), 'mobile');

  globalThis.window = { innerWidth: 834 };
  assert.equal(normalizeLayoutMode('tablet'), 'desktop');

  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
