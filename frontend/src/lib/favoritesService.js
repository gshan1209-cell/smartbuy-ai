// 收藏服務：登入時走後端 API 雲端同步，未登入 fallback localStorage。
// 元件層只使用 fetchFavorites / addFavorite / removeFavorite，不感知儲存位置。
import { loadSavedNews, toggleSavedNews } from './savedNews';
import { loadSavedProducts, toggleSavedProduct, removeSavedProduct } from './savedProducts';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

let loginCheck = null;

function isLoggedIn() {
  if (!loginCheck) {
    loginCheck = fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok)
      .catch(() => false);
  }
  return loginCheck;
}

// news: 回傳 article 物件陣列（id 一律為字串）；product: 回傳 name 字串陣列
export async function fetchFavorites(type) {
  if (await isLoggedIn()) {
    const res = await fetch(`${API_BASE}/api/favorites?type=${type}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (type === 'product') return rows.map(r => r.ref_id);
    return rows.map(r => ({ ...(r.meta ?? {}), id: String(r.ref_id) }));
  }
  if (type === 'product') return loadSavedProducts();
  return loadSavedNews().map(a => ({ ...a, id: String(a.id) }));
}

export async function addFavorite(type, refId, meta = {}) {
  if (await isLoggedIn()) {
    const res = await fetch(`${API_BASE}/api/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type, ref_id: String(refId), meta }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (type === 'product') {
    const saved = loadSavedProducts();
    if (!saved.includes(refId)) toggleSavedProduct(refId);
  } else {
    const saved = loadSavedNews();
    if (!saved.some(a => String(a.id) === String(refId))) {
      toggleSavedNews({ id: refId, ...meta });
    }
  }
}

export async function removeFavorite(type, refId) {
  if (await isLoggedIn()) {
    const res = await fetch(
      `${API_BASE}/api/favorites/${type}/${encodeURIComponent(refId)}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return;
  }
  if (type === 'product') {
    removeSavedProduct(refId);
  } else {
    // 舊 localStorage 資料的 id 可能是 number，用 String 比對找出原物件再 toggle 移除
    const target = loadSavedNews().find(a => String(a.id) === String(refId));
    if (target) toggleSavedNews(target);
  }
}
