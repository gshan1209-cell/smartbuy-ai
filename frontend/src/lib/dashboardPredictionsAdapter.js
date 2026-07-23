import { get } from '../hooks/useApi';

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

export function normalizePredictionRow(row) {
  return {
    ...row,
    crop_name: row.crop_name || row.crop_id || '未命名品項',
    market_name: row.market_name || row.market_id || '未指定市場',
    pred_label_name: row.pred_label_name || (row.pred_label_direction === 1 ? '漲' : row.pred_label_direction === -1 ? '跌' : '持平'),
    pred_confidence: Number.isFinite(Number(row.pred_confidence)) ? Number(row.pred_confidence) : 0,
    risk_level: row.risk_level || 'normal',
    base_date: row.base_date || row.global_latest_trade_date || '—',
    global_latest_trade_date: row.global_latest_trade_date || row.base_date || '—',
    data_staleness_days: Number.isFinite(Number(row.data_staleness_days)) ? Number(row.data_staleness_days) : 0,
    display_message: row.display_message || '目前沒有額外分析說明',
    risk_note: row.risk_note || '',
    model_type: row.model_type || 'LightGBM',
    payload_version: row.payload_version || null, // If missing from API, callers should display Unavailable indicator
  };
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

export async function loadDashboardPredictions(previous = null) {
  const [predictionsResult, marketsResult, productsResult] = await Promise.allSettled([
    get('/api/predictions/direction?limit=500'),
    get('/api/markets'),
    get('/api/products'),
  ]);

  const predictionsSource = sourceState(predictionsResult, previous?.raw?.predictions);
  const marketsSource = sourceState(marketsResult, previous?.raw?.markets);
  const productsSource = sourceState(productsResult, previous?.raw?.products);

  const rawPredictions = unwrapRows(predictionsSource.value);
  const predictions = rawPredictions.map(normalizePredictionRow);

  const markets = Array.isArray(marketsSource.value?.markets)
    ? marketsSource.value.markets
    : [];

  const products = unwrapRows(productsSource.value);

  // Calculate statistics
  const directionCounts = { 漲: 0, 持平: 0, 跌: 0 };
  const riskCounts = { normal: 0, medium: 0, high: 0 };
  let totalConfidence = 0;
  let staleOrMissingCount = 0;
  let latestBaseDate = null;

  predictions.forEach((row) => {
    if (row.pred_label_name in directionCounts) {
      directionCounts[row.pred_label_name] += 1;
    }
    if (row.risk_level in riskCounts) {
      riskCounts[row.risk_level] += 1;
    }
    totalConfidence += row.pred_confidence;

    if (row.data_staleness_days > 0) {
      staleOrMissingCount += 1;
    }

    if (row.base_date && row.base_date !== '—') {
      if (!latestBaseDate || String(row.base_date) > String(latestBaseDate)) {
        latestBaseDate = row.base_date;
      }
    }
  });

  const count = predictions.length;
  const avgConfidence = count > 0 ? (totalConfidence / count) : 0;
  const highRiskList = predictions.filter((r) => r.risk_level === 'high');

  return {
    predictions,
    markets,
    products,
    stats: {
      totalCount: count,
      latestBaseDate,
      directionCounts,
      riskCounts,
      avgConfidence,
      staleOrMissingCount,
      highRiskList,
    },
    sources: {
      predictions: predictionsSource,
      markets: marketsSource,
      products: productsSource,
    },
    raw: {
      predictions: predictionsSource.value,
      markets: marketsSource.value,
      products: productsSource.value,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadPredictionDrawerDetail(cropName, marketName, cropId = '', marketId = '') {
  const params = new URLSearchParams();
  if (cropId) params.set('crop_id', cropId);
  if (marketId) params.set('market_id', marketId);
  if (cropName) params.set('crop_name', cropName);
  if (marketName) params.set('market_name', marketName);

  try {
    const detail = await get(`/api/predictions/direction/latest?${params.toString()}`);
    return {
      detail: detail ? normalizePredictionRow(detail) : null,
      error: null,
    };
  } catch (error) {
    return {
      detail: null,
      error: error?.message || '無法取得該品項的最新單筆預測詳情。',
    };
  }
}
