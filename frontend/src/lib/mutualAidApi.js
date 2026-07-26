import { apiRequest } from './apiClient';

export function fetchPosts({ type, shareKind, city, q, mine, sort, limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (type && type !== '全部') params.set('type', type);
  if (shareKind && shareKind !== 'all') params.set('share_kind', shareKind);
  if (city && city !== '全部') params.set('city', city);
  if (q) params.set('q', q);
  if (mine) params.set('mine', 'true');
  if (sort) params.set('sort', sort);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return apiRequest(`/api/mutual-aid/posts?${params.toString()}`);
}

export function fetchPost(id) {
  return apiRequest(`/api/mutual-aid/posts/${id}`);
}

export function createPost(payload) {
  return apiRequest('/api/mutual-aid/posts', { method: 'POST', json: payload });
}

export function updatePost(id, payload) {
  return apiRequest(`/api/mutual-aid/posts/${id}`, { method: 'PATCH', json: payload });
}

export function deletePost(id) {
  return apiRequest(`/api/mutual-aid/posts/${id}`, { method: 'DELETE' });
}

export function updatePostStatus(id, status) {
  return apiRequest(`/api/mutual-aid/posts/${id}/status`, {
    method: 'PATCH',
    json: { status },
  });
}

export function addComment(postId, content) {
  return apiRequest(`/api/mutual-aid/posts/${postId}/comments`, {
    method: 'POST',
    json: { content },
  });
}

export function deleteComment(commentId) {
  return apiRequest(`/api/mutual-aid/comments/${commentId}`, { method: 'DELETE' });
}

export function toggleLike(postId) {
  return apiRequest(`/api/mutual-aid/posts/${postId}/like`, { method: 'POST' });
}

export function toggleSave(postId) {
  return apiRequest(`/api/mutual-aid/posts/${postId}/save`, { method: 'POST' });
}

export function fetchSavedPosts() {
  return apiRequest('/api/mutual-aid/saved');
}

export function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/api/mutual-aid/upload-image', {
    method: 'POST',
    body: formData,
  });
}
