import { classifyAgricultureItem } from '../config/agricultureCategories.js';
import { COUNTY_SPECIALTIES, FALLBACK_SPECIALTIES } from '../config/countySpecialties.js';
import { clearCachedGet, getCached } from '../hooks/useApi.js';
import { loadConsumerHome, normalizeHomeItem } from './consumerHomeAdapter.js';

const SHARED_CACHE_TTL_MS = 5 * 60 * 1000;
const SHARED_REQUEST_TIMEOUT_MS = 4000;
export function clearHomeAgricultureExplorerCache() {
  clearCachedGet();
}

export function mapMarketToCounty(marketName) {
  if (!marketName) return null;
  const name = String(marketName).replace(/台/g, '臺').trim();

  if (name.includes('臺北') || name.includes('台北')) return '臺北市';
  if (name.includes('新北') || name.includes('板橋') || name.includes('三重')) return '新北市';
  if (name.includes('基隆')) return '基隆市';
  if (name.includes('桃園') || name.includes('桃農')) return '桃園市';
  if (name.includes('新竹')) return '新竹市';
  if (name.includes('宜蘭')) return '宜蘭縣';
  if (name.includes('臺中') || name.includes('台中') || name.includes('東勢') || name.includes('豐原')) return '臺中市';
  if (name.includes('苗栗')) return '苗栗縣';
  if (name.includes('彰化') || name.includes('永靖') || name.includes('溪湖')) return '彰化縣';
  if (name.includes('南投')) return '南投縣';
  if (name.includes('雲林') || name.includes('西螺')) return '雲林縣';
  if (name.includes('臺南') || name.includes('台南')) return '臺南市';
  if (name.includes('高雄') || name.includes('鳳山')) return '高雄市';
  if (name.includes('嘉義')) return '嘉義市';
  if (name.includes('屏東')) return '屏東縣';
  if (name.includes('花蓮')) return '花蓮縣';
  if (name.includes('臺東') || name.includes('台東')) return '臺東縣';
  if (name.includes('澎湖')) return '澎湖縣';
  if (name.includes('金門')) return '金門縣';
  if (name.includes('連江')) return '連江縣';

  return null;
}

export function mapMarketsToCounties(markets) {
  const defaultAvailable = ['全部', '臺北市', '臺中市', '高雄市'];
  if (!Array.isArray(markets) || markets.length === 0) {
    return defaultAvailable;
  }
  const set = new Set(['全部']);
  markets.forEach((m) => {
    const county = mapMarketToCounty(m);
    if (county) set.add(county);
  });
  return set.size > 1 ? Array.from(set) : defaultAvailable;
}

const COUNTY_TO_MARKET = {
  '臺北市': '台北一',
  '臺中市': '台中市',
  '高雄市': '高雄市',
};

function mapCountyToMarketName(county) {
  if (!county) return '';
  const key = String(county).replace(/台/g, '臺').trim();
  return COUNTY_TO_MARKET[key] ?? String(county).replace(/臺/g, '台').trim();
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

function buildLocalSpecialties(county, liveItems) {
  const spec = county !== '全部' ? COUNTY_SPECIALTIES[county] : null;
  const cropDefs = spec ? spec.crops : FALLBACK_SPECIALTIES;
  const tagline = spec ? spec.tagline : '全台市場精選';

  const liveMap = new Map(liveItems.map((item) => [item.product_name, item]));

  return cropDefs.map(({ name, description }) => {
    const live = liveMap.get(name);
    return {
      name,
      description,
      tagline,
      todayPrice: live?.today_price ?? null,
      status: live?.status ?? '尚無行情',
      transDate: live?.trans_date ?? live?.latest_trade_date ?? '—',
      volume: live?.volume ?? null,
      priceSourceType: 'Official API',
      priceSourceStatus: live ? 'ready' : 'unavailable',
      category: classifyAgricultureItem(name).key,
    };
  });
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

  const localSpecialties = buildLocalSpecialties(selectedCounty, products);

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
