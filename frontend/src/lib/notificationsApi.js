// 站內通知 API 封裝：所有請求帶 cookie（credentials: 'include'）以配合後端 JWT cookie 認證。
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function fetchNotifications({ limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request(`/api/notifications?${params.toString()}`);
}

export function fetchUnreadCount() {
  return request('/api/notifications/unread-count');
}

export function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'PATCH' });
}
