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

export function loadRecommendation(category) {
  if (!category) return Promise.reject(new Error('請先選擇推薦分類。'));

  const requestId = ++latestRecommendationRequest;
  const requestPromise = apiRequest(
    `/api/recommendations?category=${encodeURIComponent(category)}`,
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
