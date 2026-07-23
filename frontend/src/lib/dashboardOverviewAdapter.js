import { get } from '../hooks/useApi';

const sourceDefinitions = [
  ['products', '行情 API', '/api/products'],
  ['marketIntel', '市場情報 API', '/api/market-intel'],
  ['predictions', 'AI 預測 API', '/api/predictions/direction?limit=100'],
  ['mutualAid', '互助網 API', '/api/mutual-aid/posts?limit=100&offset=0'],
];

function unwrapRows(value) {
  if (Array.isArray(value)) return value;
  return value?.items || value?.posts || value?.data || [];
}

function latestDate(rows) {
  const dates = rows.flatMap((row) => [row.trans_date, row.latest_trade_date, row.updated_at, row.base_date, row.trade_date]).filter(Boolean);
  return dates.sort().at(-1) || null;
}

function calculateProducts(rows) {
  const items = unwrapRows(rows);
  const counts = items.reduce((result, item) => { const status = item.status || '資料不足'; result[status] = (result[status] || 0) + 1; return result; }, {});
  return { count: items.length, cheap: counts.便宜 || 0, normal: counts.正常 || 0, expensive: counts.偏貴 || 0, insufficient: counts.資料不足 || 0, latestDate: latestDate(items), markets: new Set(items.map((item) => item.market_name).filter(Boolean)).size, rows: items };
}

function calculatePredictions(value) {
  const rows = unwrapRows(value); const direction = { 漲: 0, 跌: 0, 持平: 0 }; const risk = { normal: 0, medium: 0, high: 0 };
  rows.forEach((row) => { const label = row.pred_label_name || row.direction || '持平'; if (label in direction) direction[label] += 1; const level = row.risk_level || 'normal'; if (level in risk) risk[level] += 1; });
  return { count: rows.length, direction, risk, latestDate: latestDate(rows), avgConfidence: rows.length ? rows.reduce((sum, row) => sum + (Number(row.pred_confidence) || 0), 0) / rows.length : null, highRisk: rows.filter((row) => row.risk_level === 'high').slice(0, 8), rows };
}

function calculateMutualAid(value) {
  const rows = unwrapRows(value); const openStatuses = new Set(['open', 'dealing', '待處理', '處理中']);
  return { count: rows.length, open: rows.filter((row) => openStatuses.has(row.status)).length, rows: rows.filter((row) => openStatuses.has(row.status)).slice(0, 8) };
}

export async function loadDashboardOverview(previous = null) {
  const settled = await Promise.allSettled(sourceDefinitions.map(([, , endpoint]) => get(endpoint)));
  const sources = {}; const values = {};
  settled.forEach((result, index) => { const [key, label, endpoint] = sourceDefinitions[index]; if (result.status === 'fulfilled') { values[key] = result.value; const empty = (Array.isArray(result.value) && result.value.length === 0) || (result.value && typeof result.value === 'object' && !Array.isArray(result.value) && Object.keys(result.value).length === 0); sources[key] = { key, label, endpoint, status: empty ? 'empty' : 'ready', checkedAt: new Date().toISOString() }; } else { sources[key] = { key, label, endpoint, status: previous?.sources?.[key]?.status === 'ready' ? 'stale' : 'error', error: result.reason?.message || '資料來源失敗', checkedAt: new Date().toISOString() }; values[key] = previous?.raw?.[key]; } });
  return { products: values.products ? calculateProducts(values.products) : null, marketIntel: values.marketIntel || null, predictions: values.predictions ? calculatePredictions(values.predictions) : null, mutualAid: values.mutualAid ? calculateMutualAid(values.mutualAid) : null, raw: values, sources, fetchedAt: new Date().toISOString(), previous: Boolean(previous) };
}

export const unavailableSources = [
  ['members', '會員管理 API'], ['favorites', '收藏分析 API'], ['jobs', '任務監控 API'], ['errors', '系統錯誤 API'],
];
