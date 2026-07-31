export const DEMO_POINTS_SUMMARY = Object.freeze({
  balance: 150,
  lifetime_earned: 320,
  lifetime_spent: 170,
  transactions: Object.freeze([
    Object.freeze({ id: 'demo-tx-checkin', reason: '每日簽到', amount: 10, created_at: '2026-07-30T01:00:00Z' }),
    Object.freeze({ id: 'demo-tx-special-offer', reason: '瀏覽特賣商品', amount: 5, created_at: '2026-07-29T06:30:00Z' }),
    Object.freeze({ id: 'demo-tx-share', reason: '分享商品', amount: 20, created_at: '2026-07-28T03:20:00Z' }),
    Object.freeze({ id: 'demo-tx-redeem', reason: '兌換 30 元折價券', amount: -100, created_at: '2026-07-27T08:10:00Z' }),
  ]),
});

export const DEMO_AVAILABLE_COUPONS = Object.freeze([
  Object.freeze({
    id: 'demo-coupon-95-off',
    title: '95 折優惠券',
    description: '適用於 SmartBuy AI 合作通路指定商品。',
    points_cost: 50,
    discount_type: 'percent',
    discount_value: 5,
    expires_at: '2026-12-31T15:59:59Z',
    owned: false,
  }),
  Object.freeze({
    id: 'demo-coupon-30-off',
    title: '30 元折價券',
    description: '消費滿 299 元即可折抵 30 元。',
    points_cost: 100,
    discount_type: 'fixed',
    discount_value: 30,
    expires_at: '2026-12-31T15:59:59Z',
    owned: true,
  }),
  Object.freeze({
    id: 'demo-coupon-80-off',
    title: '80 元折價券',
    description: '消費滿 699 元即可折抵 80 元。',
    points_cost: 200,
    discount_type: 'fixed',
    discount_value: 80,
    expires_at: '2026-12-31T15:59:59Z',
    owned: false,
  }),
]);

export const DEMO_OWNED_COUPONS = Object.freeze([
  Object.freeze({
    id: 'demo-owned-30-off',
    title: '30 元折價券',
    description: '消費滿 299 元即可折抵 30 元。',
    redemption_code: 'SMART-DEMO-30',
    member_coupon_status: 'active',
    redeemed_at: '2026-07-27T08:10:00Z',
    expires_at: '2026-12-31T15:59:59Z',
  }),
]);

export function createPointsDemoData() {
  return {
    points: {
      ...DEMO_POINTS_SUMMARY,
      transactions: DEMO_POINTS_SUMMARY.transactions.map((item) => ({ ...item })),
    },
    coupons: DEMO_AVAILABLE_COUPONS.map((coupon) => ({ ...coupon })),
    mine: DEMO_OWNED_COUPONS.map((coupon) => ({ ...coupon })),
  };
}
