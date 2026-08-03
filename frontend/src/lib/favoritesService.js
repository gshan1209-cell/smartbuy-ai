// 收藏服務：登入時走後端 API 雲端同步，未登入 fallback localStorage。
// 元件層只使用 fetchFavorites / addFavorite / removeFavorite，不感知儲存位置。
import { apiFetch, apiRequest } from './apiClient';
import { loadSavedNews, toggleSavedNews } from './savedNews';
import { loadSavedProducts, toggleSavedProduct, removeSavedProduct } from './savedProducts';

let loginCheck = null;

export function resetFavoriteAuthCheck() {
  loginCheck = null;
}

function isLoggedIn() {
  if (!loginCheck) {
    loginCheck = apiFetch('/api/auth/me')
      .then((response) => response.ok)
      .catch(() => false);
  }
  return loginCheck;
}

// news: 回傳 article 物件陣列（id 一律為字串）；product: 回傳 name 字串陣列
export async function fetchFavorites(type) {
  if (await isLoggedIn()) {
    const params = new URLSearchParams({ type });
    const rows = await apiRequest(`/api/favorites?${params.toString()}`);
    if (type === 'product') return rows.map((row) => row.ref_id);
    return rows.map((row) => ({ ...(row.meta ?? {}), id: String(row.ref_id) }));
  }
  if (type === 'product') return loadSavedProducts();
  return loadSavedNews().map((article) => ({ ...article, id: String(article.id) }));
}

// 菜籃需要用收藏時的市場重新取得商品詳情；保留 fetchFavorites('product')
// 的字串回傳格式，避免影響查價頁與商品詳情頁既有狀態。
export async function fetchFavoriteProducts() {
  if (await isLoggedIn()) {
    const params = new URLSearchParams({ type: 'product' });
    const rows = await apiRequest(`/api/favorites?${params.toString()}`);
    return rows.map((row) => ({
      name: row.ref_id,
      market: String(row.meta?.market_name || row.meta?.market || '').trim(),
    }));
  }

  // 舊版 localStorage 只保存品名；菜籃頁會再從行情清單推回市場。
  return loadSavedProducts().map((name) => ({ name, market: '' }));
}

export async function addFavorite(type, refId, meta = {}) {
  if (await isLoggedIn()) {
    await apiRequest('/api/favorites', {
      method: 'POST',
      json: { type, ref_id: String(refId), meta },
    });
    return;
  }
  if (type === 'product') {
    const saved = loadSavedProducts();
    if (!saved.includes(refId)) toggleSavedProduct(refId);
  } else {
    const saved = loadSavedNews();
    if (!saved.some((article) => String(article.id) === String(refId))) {
      toggleSavedNews({ id: refId, ...meta });
    }
  }
}

export async function removeFavorite(type, refId) {
  if (await isLoggedIn()) {
    await apiRequest(`/api/favorites/${type}/${encodeURIComponent(refId)}`, {
      method: 'DELETE',
    });
    return;
  }
  if (type === 'product') {
    removeSavedProduct(refId);
  } else {
    // 舊 localStorage 資料的 id 可能是 number，用 String 比對找出原物件再 toggle 移除
    const target = loadSavedNews().find((article) => String(article.id) === String(refId));
    if (target) toggleSavedNews(target);
  }
}
