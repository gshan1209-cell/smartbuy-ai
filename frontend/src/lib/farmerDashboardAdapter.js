import { get } from '../hooks/useApi';
import { loadDashboardPrices } from './dashboardPricesAdapter';
import { normalizePredictionRow } from './dashboardPredictionsAdapter';

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function isEmpty(value) {
  return value == null
    || (Array.isArray(value) && value.length === 0)
    || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}

function sourceState(result, previousValue) {
  if (result.status === 'fulfilled') {
    return {
      status: isEmpty(result.value) ? 'empty' : 'ready',
      value: result.value,
      error: null,
    };
  }

  if (previousValue != null) {
    return {
      status: 'stale',
      value: previousValue,
      error: result.reason?.message || '資料更新失敗，保留上次資料',
    };
  }

  return {
    status: 'error',
    value: null,
    error: result.reason?.message || '資料載入失敗',
  };
}

export async function loadFarmerDashboard(previous = null) {
  const [pricesResult, predictionsResult, solarTermResult] = await Promise.allSettled([
    loadDashboardPrices(previous?.prices),
    get('/api/predictions/direction?limit=100'),
    get('/api/solar-term'),
  ]);

  const prices = pricesResult.status === 'fulfilled'
    ? pricesResult.value
    : previous?.prices || null;
  const predictionSource = sourceState(
    predictionsResult,
    previous?.raw?.predictions,
  );
  const solarTermSource = sourceState(
    solarTermResult,
    previous?.raw?.solarTerm,
  );
  const predictions = unwrapRows(predictionSource.value).map(normalizePredictionRow);
  const markets = prices?.markets || [
    ...new Set((prices?.products || []).map((row) => row.market_name).filter(Boolean)),
  ];

  return {
    prices,
    predictions,
    markets,
    solarTerm: solarTermSource.value,
    sources: {
      products: prices?.sources?.products || { status: 'error', error: '行情資料無法取得' },
      markets: prices?.sources?.markets || { status: 'error', error: '市場清單無法取得' },
      marketIntel: prices?.sources?.intel || { status: 'error', error: '市場情報無法取得' },
      predictions: predictionSource,
      solarTerm: solarTermSource,
    },
    raw: {
      predictions: predictionSource.value,
      solarTerm: solarTermSource.value,
    },
    fetchedAt: new Date().toISOString(),
  };
}
