import { seasonalRecommendations } from '../data/seasonalRecommendations';
import { get } from '../hooks/useApi';

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function sourceState(result, previousValue) {
  if (result.status === 'fulfilled') {
    const value = result.value;
    const empty = value == null
      || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    return { status: empty ? 'empty' : 'ready', value, error: null };
  }

  if (previousValue != null) {
    return {
      status: 'stale',
      value: previousValue,
      error: result.reason?.message || '重新整理失敗，沿用上次資料。',
    };
  }

  return {
    status: 'error',
    value: null,
    error: result.reason?.message || '資料來源載入失敗。',
  };
}

export async function loadDashboardSeasonal(previous = null) {
  const [solarTermResult, productsResult] = await Promise.allSettled([
    get('/api/solar-term'),
    get('/api/products'),
  ]);

  const solarTermSource = sourceState(solarTermResult, previous?.raw?.solarTerm);
  const productsSource = sourceState(productsResult, previous?.raw?.products);

  const solarTermData = solarTermSource.value;
  const products = unwrapRows(productsSource.value);

  const termName = solarTermData?.term_name || '當季蔬果';
  const seed = seasonalRecommendations[termName] || seasonalRecommendations.default;

  // Match static seed recommended products against formal products API
  const matchedRecommendations = seed.recommendedProducts.map((productName) => {
    const matchedProduct = products.find(
      (p) => (p.product_name || p.crop_name) === productName
        || (p.product_name || p.crop_name || '').includes(productName),
    );

    if (matchedProduct) {
      return {
        name: productName,
        matched: true,
        todayPrice: matchedProduct.today_price ?? matchedProduct.price_detail?.today_price ?? null,
        recentAverage: matchedProduct.recent_average ?? matchedProduct.price_detail?.recent_average ?? null,
        status: matchedProduct.status || matchedProduct.price_status || matchedProduct.price_detail?.status || '正常',
        suggestion: matchedProduct.suggestion || matchedProduct.price_detail?.suggestion || '尚無建議',
        transDate: matchedProduct.trans_date || matchedProduct.latest_trade_date || matchedProduct.updated_at || '—',
        marketName: matchedProduct.market_name || matchedProduct.price_detail?.market_name || '市場',
      };
    }

    return {
      name: productName,
      matched: false,
      todayPrice: null,
      recentAverage: null,
      status: productsSource.status === 'error' ? '載入失敗' : '資料不足',
      suggestion: '目前行情 API 未涵蓋此品項',
      transDate: '—',
      marketName: '—',
    };
  });

  return {
    term: solarTermData,
    seed,
    matchedRecommendations,
    sources: {
      solarTerm: solarTermSource,
      products: productsSource,
      seed: { status: 'ready', sourceNote: 'Static Seed' },
    },
    raw: {
      solarTerm: solarTermSource.value,
      products: productsSource.value,
    },
    fetchedAt: new Date().toISOString(),
  };
}
