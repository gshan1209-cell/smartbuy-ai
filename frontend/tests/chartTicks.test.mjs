import assert from 'node:assert/strict';
import test from 'node:test';

import { selectXAxisLabelIndexes } from '../src/lib/chartTicks.js';

test('short history keeps every date label', () => {
  assert.deepEqual([...selectXAxisLabelIndexes(7)], [0, 1, 2, 3, 4, 5, 6]);
});

test('14-day history reduces labels evenly while keeping both ends', () => {
  const indexes = [...selectXAxisLabelIndexes(14)];
  assert.equal(indexes.length, 7);
  assert.equal(indexes[0], 0);
  assert.equal(indexes.at(-1), 13);
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test('30-day history never exceeds the readable label limit', () => {
  const indexes = [...selectXAxisLabelIndexes(30)];
  assert.equal(indexes.length, 7);
  assert.equal(indexes[0], 0);
  assert.equal(indexes.at(-1), 29);
});
