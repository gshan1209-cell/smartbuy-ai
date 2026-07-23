import { seasonalRecommendations } from '../data/seasonalRecommendations';
import { get } from '../hooks/useApi';

// Only a very small, explicitly labelled demo set is kept to demonstrate the
// layout before a formal county-produce API is connected. Other counties show
// an honest unavailable state instead of fabricated local specialties.
const COUNTY_SPECIALTIES_DEMO = {
  宜蘭縣: [
    { name: '青蔥', desc: '示範內容：用來呈現縣市特色卡片版型。' },
    { name: '高麗菜', desc: '示範內容：正式縣市農產資料尚未接入。' },
  ],
  臺南市: [
    { name: '芒果', desc: '示範內容：用來呈現縣市特色卡片版型。' },
    { name: '番茄', desc: '示範內容：正式縣市農產資料尚未接入。' },
  ],
};

function sourceState(result, previousValue) {
  if (result.status === 'fulfilled') {
    const value = result.value;
    const empty = value == null
      || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object'
        && !Array.isArray(value)
        && Object.keys(value).length === 0);
    return { status: empty ? 'empty' : 'ready', value, error: null };
  }

  if (previousValue != null) {
    return {
      status: 'stale',
      value: previousValue,
      error: result.reason?.message || '資料讀取失敗，沿用上次成功資料。',
    };
  }

  return {
    status: 'error',
    value: null,
    error: result.reason?.message || '資料來源載入失敗。',
  };
}

function unwrapProducts(value) {
  if (Array.isArray(value)) return value;
  return value?.items || value?.data || [];
}

function getProductName(product) {
  return product?.product_name || product?.crop_name || '';
}

function findProduct(products, targetName) {
  return products.find((product) => {
    const productName = getProductName(product);
    return productName === targetName || productName.includes(targetName);
  });
}

function normalizePriceFields(product, productsSource) {
  const matched = Boolean(product);
  const sourceAvailable = ['ready', 'stale'].includes(productsSource.status);

  return {
    todayPrice: product?.today_price ?? product?.price_detail?.today_price ?? null,
    status: matched
      ? product.status
        || product.price_status
        || product.price_detail?.status
        || '資料不足'
      : productsSource.status === 'error'
        ? '載入失敗'
        : '資料不足',
    transDate: product?.trans_date
      || product?.latest_trade_date
      || product?.updated_at
      || product?.price_detail?.trans_date
      || product?.price_detail?.latest_trade_date
      || '—',
    priceSourceType: matched && sourceAvailable ? 'Official API' : 'Unavailable',
    priceSourceStatus: productsSource.status,
  };
}

export async function loadHomeAgricultureExplorer(
  selectedCounty = '宜蘭縣',
  previous = null,
) {
  const [solarTermResult, productsResult] = await Promise.allSettled([
    get('/api/solar-term'),
    get('/api/products'),
  ]);

  const solarTermSource = sourceState(
    solarTermResult,
    previous?.sources?.solarTerm?.value,
  );
  const productsSource = sourceState(
    productsResult,
    previous?.sources?.prices?.value,
  );

  const solarTermData = solarTermSource.value;
  const products = unwrapProducts(productsSource.value);
  const termName = solarTermData?.term_name || '當季';
  const seed = seasonalRecommendations[termName]
    || seasonalRecommendations.default
    || { recommendedProducts: [], cookingSuggestions: [] };

  const specialtiesDemo = COUNTY_SPECIALTIES_DEMO[selectedCounty] || [];
  const localSpecialties = specialtiesDemo.map((specialty) => {
    const matched = findProduct(products, specialty.name);
    return {
      name: specialty.name,
      description: specialty.desc,
      metadataSourceType: 'Demo',
      ...normalizePriceFields(matched, productsSource),
    };
  });

  const monthlyProduce = (seed.recommendedProducts || []).map((productName) => {
    const matched = findProduct(products, productName);
    return {
      name: productName,
      recommendationSourceType: 'Static Seed',
      ...normalizePriceFields(matched, productsSource),
    };
  });

  const currentMonth = new Date().getMonth() + 1;
  const countySourceAvailable = specialtiesDemo.length > 0;
  const checkedAt = new Date().toISOString();

  return {
    currentSolarTerm: solarTermData,
    selectedCounty,
    selectedMonth: `${currentMonth} 月`,
    localSpecialties,
    monthlyProduce,
    cookingSuggestions: seed.cookingSuggestions || [],
    sources: {
      solarTerm: {
        status: solarTermSource.status,
        type: 'Official API',
        updatedAt: checkedAt,
        error: solarTermSource.error,
        value: solarTermData,
      },
      prices: {
        status: productsSource.status,
        type: 'Official API',
        updatedAt: checkedAt,
        error: productsSource.error,
        value: productsSource.value,
      },
      countyProduce: {
        status: countySourceAvailable ? 'demo' : 'unavailable',
        type: countySourceAvailable ? 'Demo' : 'Unavailable',
        updatedAt: checkedAt,
        error: countySourceAvailable
          ? '此縣市目前僅提供少量示範內容，非正式縣市農產資料。'
          : '正式縣市農產資料 API 尚未接入。',
      },
    },
    fetchedAt: checkedAt,
  };
}
