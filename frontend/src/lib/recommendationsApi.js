import { get } from '../hooks/useApi';

export async function loadRecommendationCategories() {
  const payload = await get('/api/recommendations/categories');
  return Array.isArray(payload?.categories) ? payload.categories : [];
}

export async function loadRecommendation(category) {
  if (!category) throw new Error('請先選擇推薦分類。');
  return get(`/api/recommendations?category=${encodeURIComponent(category)}`);
}
