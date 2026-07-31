import { classifyAgricultureItem } from '../config/agricultureCategories';
import { clearCachedGet, getCached } from '../hooks/useApi';
import { loadConsumerHome, normalizeHomeItem } from './consumerHomeAdapter';

const SHARED_CACHE_TTL_MS = 5 * 60 * 1000;
const SHARED_REQUEST_TIMEOUT_MS = 4000;
export function clearHomeAgricultureExplorerCache() {
  clearCachedGet();
}

function mapCountyToMarketName(county) {
  if (!county) return '';
  return String(county).replace(/臺/g, '台').trim();
}

function normalizeExplorerItem(item) {
  return {
    name: item.product_name,
    ...item,
    todayPrice: item.today_price ?? null,
    status: item.status,
    transDate: item.trans_date ?? item.latest_trade_date ?? item.updated_at ?? '—',
    priceSourceType: 'Official API',
    priceSourceStatus: item.price_source_status ?? 'ready',
    category: classifyAgricultureItem(item.product_name).key,
  };
}

function selectExplorerProducts(products, limit = 24) {
  const statusPriority = {
    便宜: 0,
    正常: 1,
    偏貴: 2,
    資料不足: 3,
    尚無行情: 4,
    載入失敗: 5,
  };

  return [...products]
    .sort((a, b) => {
      const statusA = statusPriority[a.status] ?? statusPriority[a.price_status] ?? 99;
      const statusB = statusPriority[b.status] ?? statusPriority[b.price_status] ?? 99;
      if (statusA !== statusB) return statusA - statusB;
      return (b.volume ?? 0) - (a.volume ?? 0);
    })
    .slice(0, limit);
}

export async function loadHomeAgricultureExplorer(
  selectedCounty = '全部',
  previous = null,
  forceRefresh = false,
) {
  const market = selectedCounty && selectedCounty !== '全部'
    ? mapCountyToMarketName(selectedCounty)
    : '';
  const normalizedMarket = market ? `${market}` : '';

  const response = await loadConsumerHome(getCached, normalizedMarket);
  const products = response.items.map(normalizeHomeItem);
  const selectedProducts = selectExplorerProducts(products);

  const localSpecialties = selectedProducts.map((item) => ({
    ...normalizeExplorerItem(item),
    description: `${selectedCounty === '全部' ? '全部市場' : selectedCounty} · 市場行情`,
  }));

  const monthlyProduce = selectedProducts.map((item) => ({
    ...normalizeExplorerItem(item),
    recommendationSourceType: '價格行情 API',
  }));

  const currentMonth = new Date().getMonth() + 1;
  const checkedAt = new Date().toISOString();

  return {
    selectedCounty,
    selectedMonth: `${currentMonth} 月`,
    localSpecialties,
    monthlyProduce,
    sources: {
      prices: {
        status: response.items.length ? 'ready' : 'empty',
        type: 'Official API',
        updatedAt: checkedAt,
        error: null,
        value: response.items,
      },
    },
    fetchedAt: checkedAt,
  };
}
