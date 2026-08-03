import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DAILY_RECOMMENDATION_REGIONS,
  decisionFromRecommendation,
  isRecommendationStale,
  loadDailyRecommendation,
  presentRecommendationText,
  sourceSummaryFrom,
  tradeDataWarning,
} from '../src/lib/dailyRecommendationsApi.js';

test('regions map to one fixed market', () => {
  assert.equal(DAILY_RECOMMENDATION_REGIONS.north.marketName, '台北一');
  assert.equal(DAILY_RECOMMENDATION_REGIONS.central.marketName, '台中市');
  assert.equal(DAILY_RECOMMENDATION_REGIONS.south.marketName, '高雄市');
});

test('stale recommendation is explicit', () => {
  assert.equal(isRecommendationStale('2026-07-30', '2026-07-31'), true);
  assert.equal(isRecommendationStale('2026-07-31', '2026-07-31'), false);
});

test('trade freshness boundaries produce the required user warnings', () => {
  assert.equal(tradeDataWarning(0), '');
  assert.equal(tradeDataWarning(3), '');
  assert.equal(tradeDataWarning(4), '行情資料較舊');
  assert.equal(tradeDataWarning(7), '行情資料較舊');
  assert.equal(tradeDataWarning(8), '行情資料尚未更新，建議僅供參考');
});

test('presentation translates internal prediction target labels', () => {
  assert.equal(
    presentRecommendationText('價格方向預測只提供 next_trade_day。'),
    '價格方向預測只提供 下一個交易日。',
  );
  assert.equal(presentRecommendationText('沒有英文代碼的內容。'), '沒有英文代碼的內容。');
});

test('decision adapter prefers role-specific JSON and keeps legacy snapshots readable', () => {
  const structured = decisionFromRecommendation({
    decision: {
      primary: { label: '優先採買', items: ['高麗菜'], reason: '價格較低。' },
      watch: ['零售價仍需比較。'],
      know: ['資料為批發平均價。'],
      do: ['先比較零售價。', '分批採買。'],
      evidence: ['平均價格 20 元。'],
    },
  }, 'consumer');
  assert.equal(structured.mode, 'structured');
  assert.deepEqual(structured.primaryItems, ['高麗菜']);
  assert.deepEqual(structured.do, ['先比較零售價。', '分批採買。']);

  const legacy = decisionFromRecommendation({
    summary: '依現有資料比較。',
    actions: ['先比較價格。', '分批採買。'],
    risks: ['資料仍需留意。'],
  }, 'consumer');
  assert.equal(legacy.mode, 'legacy');
  assert.equal(legacy.primaryLabel, '優先採買');
  assert.deepEqual(legacy.watch, ['資料仍需留意。']);
});

test('legacy published JSON receives safe source defaults and derived age', () => {
  const source = sourceSummaryFrom({ recommendation_date: '2026-07-31', source_summary: { latest_trade_date: '2026-07-23' } });
  assert.equal(source.trade_data_age_days, 8);
  assert.equal(source.includes_price_prediction, false);
  assert.deepEqual(source.missing_sources, []);
  assert.deepEqual(source.source_warnings, []);
});

test('loader follows latest pointer instead of hard-coding a date', async () => {
  const calls = [];
  const fetchImpl = async (path) => {
    calls.push(path);
    return {
      ok: true,
      json: async () => calls.length === 1
        ? { markets: { 'taipei-1': '2026-07-31/taipei-1.json' } }
        : { market: { key: 'taipei-1' } },
    };
  };
  await loadDailyRecommendation('north', { fetchImpl });
  assert.deepEqual(calls, [
    '/recommendations-daily/latest.json',
    '/recommendations-daily/2026-07-31/taipei-1.json',
  ]);
});

test('published pointer uses the versioned ChatGPT release without changing the old date folder', async () => {
  const latest = JSON.parse(await readFile(new URL('../public/recommendations-daily/latest.json', import.meta.url), 'utf8'));
  assert.equal(latest.release_dir, '2026-07-31-chatgpt-2026-08-03-role-decision-v2');
  assert.match(latest.markets['taipei-1'], /^2026-07-31-chatgpt-2026-08-03-role-decision-v2\/taipei-1\.json$/);
});

test('recommendation page removes legacy category and dashboard controls', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/DashboardRecommendations.jsx', import.meta.url), 'utf8');
  for (const removedText of ['分類選單', '價格狀態分布', '監測品項', '趨勢圖', '可優先採買', '維持比較']) {
    assert.equal(page.includes(removedText), false, `legacy text remains: ${removedText}`);
  }
  assert.match(page, /已對應市場/);
  assert.match(page, /今日推薦尚未更新/);
});
