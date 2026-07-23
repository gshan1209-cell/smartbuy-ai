import { getPriceStatus } from './consumerAdvice';

const demoItems = [
  { product_name: '高麗菜', today_price: 32, status: '便宜', market_name: '示範市場' },
  { product_name: '番茄', today_price: 58, status: '正常', market_name: '示範市場' },
  { product_name: '青蔥', today_price: 96, status: '偏貴', market_name: '示範市場' },
];

export async function loadConsumerHome(getApi) {
  try {
    const items = await getApi('/api/products');
    return { items: (Array.isArray(items) ? items : []).slice(0, 3), isDemo: false };
  } catch {
    return { items: demoItems, isDemo: true };
  }
}

export function normalizeHomeItem(item) {
  return { ...item, status: getPriceStatus(item), updatedAt: item.updated_at || item.latest_trade_date || '示範資料' };
}
