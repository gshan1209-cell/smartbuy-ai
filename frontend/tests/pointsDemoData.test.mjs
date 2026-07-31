import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEMO_AVAILABLE_COUPONS,
  DEMO_OWNED_COUPONS,
  DEMO_POINTS_SUMMARY,
  createPointsDemoData,
} from '../src/pages/pointsDemoData.js';

test('points demo data keeps every public section populated', () => {
  assert.deepEqual(
    [DEMO_POINTS_SUMMARY.balance, DEMO_POINTS_SUMMARY.lifetime_earned, DEMO_POINTS_SUMMARY.lifetime_spent],
    [150, 320, 170],
  );
  assert.equal(DEMO_POINTS_SUMMARY.transactions.length >= 4, true);
  assert.deepEqual(
    DEMO_AVAILABLE_COUPONS.map(({ points_cost, title }) => [points_cost, title]),
    [
      [50, '95 折優惠券'],
      [100, '30 元折價券'],
      [200, '80 元折價券'],
    ],
  );
  assert.equal(DEMO_OWNED_COUPONS.length >= 1, true);
  assert.equal(DEMO_OWNED_COUPONS[0].member_coupon_status, 'active');
});

test('points demo factory returns mutable copies without changing the source', () => {
  const first = createPointsDemoData();
  const second = createPointsDemoData();

  first.points.balance += 10;
  first.coupons[0].owned = true;

  assert.equal(second.points.balance, 150);
  assert.equal(second.coupons[0].owned, false);
});
