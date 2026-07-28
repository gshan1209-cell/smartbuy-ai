import { IS_TEST_MODE } from '../config/testMode';
import { apiRequest } from './apiClient';

let latestRecommendationRequest = 0;
let latestRecommendationPromise = Promise.resolve(null);

function normalizeRecommendationError(error) {
  const message = error?.message || '推薦資料載入失敗。';
  if (IS_TEST_MODE && (error?.status === 401 || error?.status === 403 || /登入|授權|401|403/i.test(message))) {
    return new Error('測試模式目前未連接推薦 API；畫面可瀏覽，但即時推薦資料尚未提供。');
  }
  return error instanceof Error ? error : new Error(message);
}

export async function loadRecommendationCategories() {
  try {
    const payload = await apiRequest('/api/recommendations/categories', { timeoutMs: 8000 });
    return Array.isArray(payload?.categories) ? payload.categories : [];
  } catch (error) {
    throw normalizeRecommendationError(error);
  }
}

export async function loadRecommendationMarkets(filters = {}) {
  try {
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
  const requestPromise = apiRequest(
    `/api/recommendations?${params.toString()}`,
    { timeoutMs: 150000 },
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
