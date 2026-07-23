import { getPriceStatus } from './consumerAdvice';

const demoItems = [
  {
    product_name: '高麗菜',
    today_price: 32,
    status: '便宜',
    market_name: '示範市場',
    trans_date: '示範資料',
    volume: 1200,
  },
  {
    product_name: '番茄',
    today_price: 58,
    status: '正常',
    market_name: '示範市場',
    trans_date: '示範資料',
    volume: 900,
  },
  {
    product_name: '青蔥',
    today_price: 96,
    status: '偏貴',
    market_name: '示範市場',
    trans_date: '示範資料',
    volume: 700,
  },
];

const statusPriority = {
  便宜: 0,
  正常: 1,
  偏貴: 2,
  資料不足: 3,
};

export async function loadConsumerHome(getApi) {
  try {
    const response = await getApi('/api/products');
    const items = Array.isArray(response) ? response : [];

    if (!items.length) {
      return { items: demoItems, isDemo: true };
    }

    return { items, isDemo: false };
  } catch {
    return { items: demoItems, isDemo: true };
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
