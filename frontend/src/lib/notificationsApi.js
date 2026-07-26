import { apiRequest } from './apiClient';

export function fetchNotifications({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiRequest(`/api/notifications?${params.toString()}`);
}

export function fetchUnreadCount() {
  return apiRequest('/api/notifications/unread-count');
}

export function markNotificationRead(id) {
  return apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest('/api/notifications/read-all', { method: 'PATCH' });
}
