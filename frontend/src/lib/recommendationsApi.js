import { get } from '../hooks/useApi';

let latestRecommendationRequest = 0;
let latestRecommendationPromise = Promise.resolve(null);

export async function loadRecommendationCategories() {
  const payload = await get('/api/recommendations/categories');
  return Array.isArray(payload?.categories) ? payload.categories : [];
}

export function loadRecommendation(category) {
  if (!category) return Promise.reject(new Error('請先選擇推薦分類。'));

  const requestId = ++latestRecommendationRequest;
  const requestPromise = get(`/api/recommendations?category=${encodeURIComponent(category)}`);
  latestRecommendationPromise = requestPromise;

  return requestPromise.then((payload) => {
    // 使用者快速切換分類時，較舊請求不得覆蓋最新分類；舊呼叫者改等待
    // 最新請求並取得相同結果，避免 Dashboard 最終顯示錯誤分類。
    if (requestId !== latestRecommendationRequest) return latestRecommendationPromise;
    return payload;
  });
}
