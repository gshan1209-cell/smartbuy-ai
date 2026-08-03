const BASE_URL = '/recommendations-daily';

export const DAILY_RECOMMENDATION_REGIONS = {
  north: { label: '北部', marketKey: 'taipei-1', marketName: '台北一' },
  central: { label: '中部', marketKey: 'taichung-city', marketName: '台中市' },
  south: { label: '南部', marketKey: 'kaohsiung-city', marketName: '高雄市' },
};

export function taipeiDateString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isRecommendationStale(recommendationDate, today = taipeiDateString()) {
  return Boolean(recommendationDate && recommendationDate !== today);
}

export function tradeDataAgeDays(recommendationDate, latestTradeDate) {
  if (!recommendationDate || !latestTradeDate) return null;
  const age = Math.round((Date.parse(`${recommendationDate}T00:00:00Z`) - Date.parse(`${latestTradeDate}T00:00:00Z`)) / 86400000);
  return Math.max(age, 0);
}

export function tradeDataWarning(ageDays) {
  if (ageDays == null) return '未取得行情交易日期。';
  if (ageDays > 7) return '行情資料尚未更新，建議僅供參考';
  if (ageDays >= 4) return '行情資料較舊';
  return '';
}

export function presentRecommendationText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\bnext_trade_day\b/g, '下一個交易日');
}

const PRIMARY_LABELS = {
  consumer: '優先採買',
  farmer: '優先採收／出貨',
  merchant: '優先進貨／銷售',
};

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

export function decisionFromRecommendation(recommendation, role = 'consumer') {
  const decision = recommendation?.decision;
  if (decision?.primary && Array.isArray(decision.primary.items)) {
    return {
      mode: 'structured',
      primaryLabel: decision.primary.label || PRIMARY_LABELS[role] || '優先處理',
      primaryItems: stringList(decision.primary.items),
      primaryReason: typeof decision.primary.reason === 'string' ? decision.primary.reason : '',
      watch: stringList(decision.watch),
      know: stringList(decision.know),
      do: stringList(decision.do),
      evidence: stringList(decision.evidence),
    };
  }
  const actions = stringList(recommendation?.actions);
  return {
    mode: 'legacy',
    primaryLabel: PRIMARY_LABELS[role] || '優先處理',
    primaryItems: actions.slice(0, 3),
    primaryReason: typeof recommendation?.summary === 'string' ? recommendation.summary : '',
    watch: stringList(recommendation?.risks),
    know: [],
    do: actions,
    evidence: [],
  };
}

export function sourceSummaryFrom(document) {
  const source = document?.source_summary || {};
  const ageDays = source.trade_data_age_days ?? tradeDataAgeDays(document?.recommendation_date, source.latest_trade_date);
  return {
    ...source,
    trade_data_age_days: ageDays,
    prediction_target_date: source.prediction_target_date ?? null,
    news_start_date: source.news_start_date ?? null,
    news_end_date: source.news_end_date ?? null,
    product_count: source.product_count ?? null,
    includes_price_prediction: source.includes_price_prediction ?? false,
    includes_recent_news: source.includes_recent_news ?? false,
    missing_sources: Array.isArray(source.missing_sources) ? source.missing_sources : [],
    source_warnings: Array.isArray(source.source_warnings) ? source.source_warnings : [],
  };
}

async function readJson(path, fetchImpl) {
  const response = await fetchImpl(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`每日推薦載入失敗（${response.status}）`);
  return response.json();
}

export async function loadDailyRecommendation(region, { fetchImpl = fetch } = {}) {
  const mapping = DAILY_RECOMMENDATION_REGIONS[region];
  if (!mapping) throw new Error('請先選擇區域。');
  const latest = await readJson(`${BASE_URL}/latest.json`, fetchImpl);
  const relativePath = latest.markets?.[mapping.marketKey];
  if (!relativePath) throw new Error(`latest.json 未提供${mapping.marketName}推薦路徑。`);
  const document = await readJson(`${BASE_URL}/${relativePath}`, fetchImpl);
  if (document.market?.key !== mapping.marketKey) throw new Error('每日推薦市場資料不一致。');
  return { latest, document, mapping };
}
