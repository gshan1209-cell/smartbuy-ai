import { apiRequest } from './apiClient';

export function fetchPoints() {
  return apiRequest('/api/points');
}

export function fetchCoupons() {
  return apiRequest('/api/coupons');
}

export function fetchMyCoupons() {
  return apiRequest('/api/coupons/mine');
}

export function redeemCoupon(id) {
  return apiRequest(`/api/coupons/${id}/redeem`, { method: 'POST' });
}

export function fetchAdminCoupons() {
  return apiRequest('/api/admin/coupons');
}

export function createAdminCoupon(payload) {
  return apiRequest('/api/admin/coupons', { method: 'POST', json: payload });
}

export function updateAdminCoupon(id, payload) {
  return apiRequest(`/api/admin/coupons/${id}`, { method: 'PATCH', json: payload });
}
