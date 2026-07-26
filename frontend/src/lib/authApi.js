import { apiRequest } from './apiClient';

export function fetchDashboardAccess() {
  return apiRequest('/api/admin/access');
}

export function loginAccount({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    json: { email, password },
  });
}

export function logoutAccount() {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    parse: 'none',
  });
}

export function registerAccount({ name, email, password }) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    json: { name, email, password },
  });
}

export function updateAccountProfile(patch) {
  return apiRequest('/api/auth/profile', {
    method: 'PATCH',
    json: patch,
  });
}
