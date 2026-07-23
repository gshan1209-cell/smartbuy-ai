import { get } from '../hooks/useApi';

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.data || [];
}

function valueFrom(row, key) {
  return row?.[key] ?? row?.price_detail?.[key] ?? null;
}

export function normalizePriceRow(row) {
  return {
    ...row,
    product_name: row.product_name || row.crop_name || '未命名品項',
    market_name: valueFrom(row, 'market_name'),
    today_price: valueFrom(row, 'today_price'),
    recent_average: valueFrom(row, 'recent_average'),
    status: row.status || row.price_status || row.price_detail?.status || '資料不足',
    suggestion: row.suggestion || row.price_detail?.suggestion || '目前沒有採買建議',
    trans_date:
      valueFrom(row, 'trans_date')
      || valueFrom(row, 'latest_trade_date')
      || valueFrom(row, 'updated_at'),
    upper_price: valueFrom(row, 'upper_price'),
    middle_price: valueFrom(row, 'middle_price'),
    lower_price: valueFrom(row, 'lower_price'),
    volume: valueFrom(row, 'volume'),
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

export async function loadDashboardPrices(previous = null) {
  const [productsResult, marketsResult, intelResult] = await Promise.allSettled([
    get('/api/products'),
    get('/api/markets'),
    get('/api/market-intel'),
  ]);

  const productsSource = sourceState(productsResult, previous?.raw?.products);
  const marketsSource = sourceState(marketsResult, previous?.raw?.markets);
  const intelSource = sourceState(intelResult, previous?.raw?.intel);
  const products = unwrapRows(productsSource.value).map(normalizePriceRow);
  const markets = Array.isArray(marketsSource.value?.markets)
    ? marketsSource.value.markets
    : [];

  return {
    products,
    markets,
    intel: intelSource.value,
    sources: {
      products: productsSource,
      markets: marketsSource,
      intel: intelSource,
    },
    raw: {
      products: productsSource.value,
      markets: marketsSource.value,
      intel: intelSource.value,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadPriceDrawerDetail(productName, marketName = '') {
  const encodedName = encodeURIComponent(productName);
  const query = marketName ? `?market=${encodeURIComponent(marketName)}` : '';
  const separator = marketName ? '&' : '?';

  const [detailResult, historyResult] = await Promise.allSettled([
    get(`/api/products/${encodedName}${query}`),
    get(`/api/products/${encodedName}/history${query}${separator}days=30`),
  ]);

  return {
    detail: detailResult.status === 'fulfilled' ? detailResult.value : null,
    history: historyResult.status === 'fulfilled'
      ? historyResult.value?.history || []
      : [],
    detailError: detailResult.status === 'rejected'
      ? detailResult.reason?.message || '商品詳情載入失敗。'
      : null,
    historyError: historyResult.status === 'rejected'
      ? historyResult.reason?.message || '歷史行情載入失敗。'
      : null,
  };
}
