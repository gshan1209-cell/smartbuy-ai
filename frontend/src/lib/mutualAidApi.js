// 互助網 API 封裝：所有請求帶 cookie（credentials: 'include'）以配合後端 JWT cookie 認證。
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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

function jsonBody(payload) {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}

export function fetchPosts({ type, city, q, mine, sort, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (type && type !== '全部') params.set('type', type);
  if (city && city !== '全部') params.set('city', city);
  if (q) params.set('q', q);
  if (mine) params.set('mine', 'true');
  if (sort) params.set('sort', sort);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request(`/api/mutual-aid/posts?${params.toString()}`);
}

export function fetchPost(id) {
  return request(`/api/mutual-aid/posts/${id}`);
}

export function createPost(payload) {
  return request('/api/mutual-aid/posts', { method: 'POST', ...jsonBody(payload) });
}

export function updatePost(id, payload) {
  return request(`/api/mutual-aid/posts/${id}`, { method: 'PATCH', ...jsonBody(payload) });
}

export function deletePost(id) {
  return request(`/api/mutual-aid/posts/${id}`, { method: 'DELETE' });
}

export function updatePostStatus(id, status) {
  return request(`/api/mutual-aid/posts/${id}/status`, { method: 'PATCH', ...jsonBody({ status }) });
}

export function addComment(postId, content) {
  return request(`/api/mutual-aid/posts/${postId}/comments`, { method: 'POST', ...jsonBody({ content }) });
}

export function deleteComment(commentId) {
  return request(`/api/mutual-aid/comments/${commentId}`, { method: 'DELETE' });
}

export function toggleLike(postId) {
  return request(`/api/mutual-aid/posts/${postId}/like`, { method: 'POST' });
}

export function toggleSave(postId) {
  return request(`/api/mutual-aid/posts/${postId}/save`, { method: 'POST' });
}

export function fetchSavedPosts() {
  return request('/api/mutual-aid/saved');
}

export function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/mutual-aid/upload-image', { method: 'POST', body: formData });
}
