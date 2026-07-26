const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `API 回傳 HTTP ${response.status}`);
  return payload;
}

export function fetchPoints() { return request('/api/points'); }
export function fetchCoupons() { return request('/api/coupons'); }
export function fetchMyCoupons() { return request('/api/coupons/mine'); }
export function redeemCoupon(id) { return request(`/api/coupons/${id}/redeem`, { method: 'POST' }); }
export function fetchAdminCoupons() { return request('/api/admin/coupons'); }
export function createAdminCoupon(payload) { return request('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) }); }
export function updateAdminCoupon(id, payload) { return request(`/api/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
