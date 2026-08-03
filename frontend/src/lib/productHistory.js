import { get } from '../hooks/useApi.js';

// Render cold starts plus the backend's price-feature lookup can exceed the
// normal live-read timeout. Keep this timeout local to the chart request so a
// slow history query does not make the rest of the app wait longer.
export const PRODUCT_HISTORY_TIMEOUT_MS = 20_000;

export function buildProductHistoryPath(productName, market, days = 180) {
  const params = new URLSearchParams({ days: String(days) });
  if (market) params.set('market', market);
  return `/api/products/${encodeURIComponent(productName)}/history?${params.toString()}`;
}

export function selectProductHistoryRows(history, period, customFrom = '', customTo = '') {
  const rows = Array.isArray(history) ? history : [];
  if (period === 'custom' && customFrom && customTo) {
    return rows.filter((row) => row.date >= customFrom && row.date <= customTo);
  }

  const days = Number(period);
  return Number.isFinite(days) && days > 0 ? rows.slice(-days) : rows;
}

export async function loadProductHistory(
  productName,
  market,
  period,
  customFrom = '',
  customTo = '',
  { fetcher = get, signal } = {},
) {
  const payload = await fetcher(
    buildProductHistoryPath(productName, market),
    { timeoutMs: PRODUCT_HISTORY_TIMEOUT_MS, signal },
  );
  return selectProductHistoryRows(payload?.history, period, customFrom, customTo);
}
