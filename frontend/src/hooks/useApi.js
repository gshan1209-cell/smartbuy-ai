import { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '';

export function useApi(path) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    fetch(BASE + path)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading, error };
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('yz_auth_token');
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extra }
    : { 'Content-Type': 'application/json', ...extra };
}

export async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function put(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function get(path, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(BASE + path, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = new Error(res.statusText || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`資料來源超過 ${Math.ceil(timeoutMs / 1000)} 秒未回應`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
