import { seasonalRecommendations } from '../data/seasonalRecommendations';
import { get } from '../hooks/useApi';

export const COUNTY_AGRICULTURE_SOURCES = {
  publication: {
    name: '農業部農業統計書刊',
    type: 'Official Publication',
    url: 'https://agrstat.moa.gov.tw/sdweb/public/book/Book.aspx',
  },
  openData: {
    name: '農業部農情調查開放資料',
    type: 'Official API',
    url: 'https://data.gov.tw/dataset/7302',
  },
};

const SHARED_CACHE_TTL_MS = 5 * 60 * 1000;
const COUNTY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SHARED_REQUEST_TIMEOUT_MS = 4000;
const COUNTY_REQUEST_TIMEOUT_MS = 6000;
const requestCache = new Map();

function cachedGet(path, ttlMs, forceRefresh = false, timeoutMs = SHARED_REQUEST_TIMEOUT_MS) {
  const now = Date.now();
  const cached = requestCache.get(path);

  if (!forceRefresh && cached?.value !== undefined && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (!forceRefresh && cached?.promise) {
    return cached.promise;
  }

  const promise = get(path, { timeoutMs })
    .then((value) => {
      if (requestCache.get(path)?.promise === promise) {
        requestCache.set(path, {
          value,
          expiresAt: Date.now() + ttlMs,
          promise: null,
        });
      }
      return value;
    })
    .catch((error) => {
      if (requestCache.get(path)?.promise === promise) {
        if (cached?.value !== undefined) {
          requestCache.set(path, { ...cached, promise: null });
        } else {
          requestCache.delete(path);
        }
      }
      throw error;
    });

  requestCache.set(path, {
    value: cached?.value,
    expiresAt: cached?.expiresAt || 0,
    promise,
  });
  return promise;
}

export function clearHomeAgricultureExplorerCache() {
  requestCache.clear();
}

// Only a very small, explicitly labelled demo set is kept to demonstrate the
// layout before a formal county-produce ETL/API is connected. Other counties
// show an honest unavailable state instead of fabricated local specialties.
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

const PRODUCT_NAME_ALIASES = {
  甘藍: '高麗菜',
  結球甘藍: '高麗菜',
  高麗菜: '高麗菜',
  青蔥: '蔥',
  蔥: '蔥',
  食用玉米: '玉米',
  甜玉米: '玉米',
  番石榴: '芭樂',
  芭樂: '芭樂',
};

function normalizeProductName(name = '') {
  const compactName = String(name).replace(/\s+/g, '').trim();
  const baseName = compactName.split(/[-－–—(（]/, 1)[0];
  return PRODUCT_NAME_ALIASES[compactName]
    || PRODUCT_NAME_ALIASES[baseName]
    || baseName;
}

function findProduct(products, targetName) {
  const normalizedTarget = normalizeProductName(targetName);
  return products.find((product) => {
    const productName = normalizeProductName(getProductName(product));
    if (productName === normalizedTarget) return true;
    if (Math.min(productName.length, normalizedTarget.length) < 2) return false;
    return productName.includes(normalizedTarget)
      || normalizedTarget.includes(productName);
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
        : '尚無行情',
    transDate: product?.trans_date
      || product?.latest_trade_date
      || product?.updated_at
      || product?.price_detail?.trans_date
      || product?.price_detail?.latest_trade_date
      || '—',
    priceSourceType: matched && sourceAvailable ? 'Official API' : 'Unavailable',
    priceSourceStatus: productsSource.status,
    isHistoricalPrice: Boolean(product?.is_historical),
    priceAgeDays: product?.age_days ?? null,
  };
}

export async function loadHomeAgricultureExplorer(
  selectedCounty = '宜蘭縣',
  previous = null,
  forceRefresh = false,
) {
  const countyPath = `/api/agriculture/county-crops?county=${encodeURIComponent(selectedCounty)}&limit=24`;
  const [solarTermResult, productsResult, countyCropsResult] = await Promise.allSettled([
    cachedGet(
      '/api/solar-term',
      SHARED_CACHE_TTL_MS,
      forceRefresh,
      SHARED_REQUEST_TIMEOUT_MS,
    ),
    cachedGet(
      '/api/products',
      SHARED_CACHE_TTL_MS,
      forceRefresh,
      SHARED_REQUEST_TIMEOUT_MS,
    ),
    cachedGet(
      countyPath,
      COUNTY_CACHE_TTL_MS,
      forceRefresh,
      COUNTY_REQUEST_TIMEOUT_MS,
    ),
  ]);

  const solarTermSource = sourceState(
    solarTermResult,
    previous?.sources?.solarTerm?.value,
  );
  const productsSource = sourceState(
    productsResult,
    previous?.sources?.prices?.value,
  );
  const countyCropsSource = sourceState(
    countyCropsResult,
    previous?.selectedCounty === selectedCounty
      ? previous?.sources?.countyProduce?.value
      : null,
  );

  const solarTermData = solarTermSource.value;
  const products = unwrapProducts(productsSource.value);
  const termName = solarTermData?.term_name || '當季';
  const seed = seasonalRecommendations[termName]
    || seasonalRecommendations.default
    || { recommendedProducts: [], cookingSuggestions: [] };

  const officialCrops = countyCropsSource.value?.items || [];
  const localSpecialties = officialCrops.map((specialty) => {
    const matched = findProduct(products, specialty.name);
    return {
      name: specialty.name,
      description: `${specialty.township || selectedCounty} · ${specialty.year || '年度資料'}，種植面積 ${specialty.plantingArea ?? '—'} 公頃。`,
      metadataSourceType: 'Official API',
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
  const countySourceAvailable = countyCropsSource.status === 'ready' && officialCrops.length > 0;
  const checkedAt = new Date().toISOString();

  return {
    currentSolarTerm: solarTermData,
    selectedCounty,
    selectedMonth: `${currentMonth} 月`,
    localSpecialties,
    monthlyProduce,
    cookingSuggestions: seed.cookingSuggestions || [],
    officialCountySources: COUNTY_AGRICULTURE_SOURCES,
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
        status: countyCropsSource.status,
        type: countySourceAvailable ? 'Official API' : 'Unavailable',
        referenceType: 'Official API',
        referenceUrl: COUNTY_AGRICULTURE_SOURCES.openData.url,
        value: countyCropsSource.value,
        openDataUrl: COUNTY_AGRICULTURE_SOURCES.openData.url,
        updatedAt: checkedAt,
        error: countySourceAvailable
          ? null
          : countyCropsSource.error || '此縣市目前沒有可用的農情調查資料。',
      },
    },
    fetchedAt: checkedAt,
  };
}
