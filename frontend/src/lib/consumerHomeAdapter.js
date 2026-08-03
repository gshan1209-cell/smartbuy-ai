import { getPriceStatus } from './consumerAdvice.js';

const statusPriority = {
  便宜: 0,
  正常: 1,
  偏貴: 2,
  資料不足: 3,
};

export async function loadConsumerHome(getApi, market = '') {
  const path = market
    ? `/api/products?market=${encodeURIComponent(market)}`
    : '/api/products';
  try {
    const response = await getApi(path);
    const items = Array.isArray(response) ? response : [];

    return { items, isDemo: false };
  } catch {
    throw new Error('目前無法取得即時行情資料。');
  }
}

export function normalizeHomeItem(item) {
  return {
    ...item,
    status: getPriceStatus(item),
    updatedAt:
      item.trans_date
      ?? item.latest_trade_date
      ?? item.updated_at
      ?? '資料日期未提供',
  };
}

export function selectConsumerHomeItems(items, limit = 3) {
  return [...items]
    .sort((a, b) => {
      const statusDifference =
        (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);

      if (statusDifference !== 0) return statusDifference;
      return (b.volume ?? 0) - (a.volume ?? 0);
    })
    .slice(0, limit);
}
