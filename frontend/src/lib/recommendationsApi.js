import { IS_TEST_MODE } from '../config/testMode';
import { apiRequest } from './apiClient';

let latestRecommendationRequest = 0;
let latestRecommendationPromise = Promise.resolve(null);

const RECOMMENDATION_SOURCE = (
  import.meta.env.VITE_RECOMMENDATION_SOURCE
  || (import.meta.env.PROD ? 'static-cache' : 'api')
).trim().toLowerCase();
const USE_STATIC_RECOMMENDATION_CACHE = RECOMMENDATION_SOURCE === 'static-cache';
const STATIC_CACHE_BASE_URL = '/recommendations-cache/v5';
let staticManifestPromise = null;

async function loadStaticManifest() {
  if (!staticManifestPromise) {
    staticManifestPromise = fetch(`${STATIC_CACHE_BASE_URL}/index.json`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Git 靜態推薦快取索引載入失敗（HTTP ${response.status}）`);
      }
      return response.json();
    });
  }
  return staticManifestPromise;
}

function staticCacheEntry(manifest, category, market, region) {
  return manifest.entries?.find((entry) => (
    entry.category === category
    && entry.market === market
    && (!region || entry.region === region)
  ));
}

function asStaticRecommendationResponse(document, role) {
  const data = { ...document };
  const consumerRecommendation = data.role_recommendations?.consumer;
  data.recommendation = consumerRecommendation;
  const response = {
    category: data.category?.key,
    region: data.region || null,
    market: data.market || null,
    cache_hit: true,
    llm_called: false,
    cache_backend: 'git-static',
    generation_source: data.generator === 'rules-fallback' ? 'rule_fallback' : 'llm',
    generated_at: data.generated_at,
    data_status: data.source_summary?.data_status,
    source_name: data.source_summary?.source_name,
    prompt_set_version: data.prompt_set_version,
    data,
    role_recommendations: data.role_recommendations,
    recommendations: consumerRecommendation?.items || [],
  };

  if (role) {
    const selectedRecommendation = data.role_recommendations?.[role];
    response.selected_role = role;
    response.selected_recommendation = selectedRecommendation;
    data.selected_role = role;
    data.selected_recommendation = selectedRecommendation;
  }

  return response;
}

async function loadStaticRecommendation(category, role, filters = {}) {
  const manifest = await loadStaticManifest();
  const entry = staticCacheEntry(manifest, category, filters.market, filters.region);
  if (!entry) {
    throw new Error(`目前沒有「${filters.market || '此市場'}／${category}」的 Git 靜態快取`);
  }

  const response = await fetch(
    `${STATIC_CACHE_BASE_URL}/${encodeURIComponent(entry.filename)}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  );
  if (!response.ok) {
    throw new Error(`Git 靜態推薦快取載入失敗（HTTP ${response.status}）`);
  }
  return asStaticRecommendationResponse(await response.json(), role);
}

function normalizeRecommendationError(error) {
  const message = error?.message || '推薦資料載入失敗。';
  if (IS_TEST_MODE && (error?.status === 401 || error?.status === 403 || /登入|授權|401|403/i.test(message))) {
    return new Error('測試模式目前未連接推薦 API；畫面可瀏覽，但即時推薦資料尚未提供。');
  }
  return error instanceof Error ? error : new Error(message);
}

export async function loadRecommendationCategories() {
  try {
    if (USE_STATIC_RECOMMENDATION_CACHE) {
      const manifest = await loadStaticManifest();
      return Array.isArray(manifest.categories) ? manifest.categories : [];
    }
    const payload = await apiRequest('/api/recommendations/categories', { timeoutMs: 8000 });
    return Array.isArray(payload?.categories) ? payload.categories : [];
  } catch (error) {
    throw normalizeRecommendationError(error);
  }
}

export async function loadRecommendationMarkets(filters = {}) {
  try {
    if (USE_STATIC_RECOMMENDATION_CACHE) {
      const manifest = await loadStaticManifest();
      const markets = new Set(
        (manifest.entries || [])
          .filter((entry) => (
            (!filters.category || entry.category === filters.category)
            && (!filters.region || entry.region === filters.region)
          ))
          .map((entry) => entry.market),
      );
      return [...markets].sort((left, right) => left.localeCompare(right, 'zh-TW'));
    }
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.region) params.set('region', filters.region);
    const query = params.toString();
    const payload = await apiRequest(`/api/markets${query ? `?${query}` : ''}`, { timeoutMs: 8000 });
    return Array.isArray(payload?.markets) ? payload.markets : [];
  } catch (error) {
    throw normalizeRecommendationError(error);
  }
}

export function loadRecommendation(category, role, filters = {}) {
  if (!category) return Promise.reject(new Error('請先選擇推薦分類。'));

  const requestId = ++latestRecommendationRequest;
  const params = new URLSearchParams({ category });
  if (role) params.set('role', role);
  if (filters.region) params.set('region', filters.region);
  if (filters.market) params.set('market', filters.market);
  const requestPromise = (USE_STATIC_RECOMMENDATION_CACHE
    ? loadStaticRecommendation(category, role, filters)
    : apiRequest(`/api/recommendations?${params.toString()}`, { timeoutMs: 150000 })
  ).catch((error) => {
    throw normalizeRecommendationError(error);
  });
  latestRecommendationPromise = requestPromise;

  return requestPromise.then((payload) => {
    // 使用者快速切換分類時，較舊請求不得覆蓋最新分類；舊呼叫者改等待
    // 最新請求並取得相同結果，避免 Dashboard 最終顯示錯誤分類。
    if (requestId !== latestRecommendationRequest) return latestRecommendationPromise;
    return payload;
  });
}
