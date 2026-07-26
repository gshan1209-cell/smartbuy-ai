import { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '';
const sharedGetCache = new Map();

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

export function clearCachedGet(paths = null) {
  if (!paths) {
    sharedGetCache.clear();
    return;
  }
  for (const path of paths) sharedGetCache.delete(path);
}

export function getCached(
  path,
  { ttlMs = 5 * 60 * 1000, timeoutMs = 8000, forceRefresh = false } = {},
) {
  const now = Date.now();
  const cached = sharedGetCache.get(path);

  if (!forceRefresh && cached?.value !== undefined && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (!forceRefresh && cached?.promise) return cached.promise;

  const promise = get(path, { timeoutMs })
    .then((value) => {
      if (sharedGetCache.get(path)?.promise === promise) {
        sharedGetCache.set(path, {
          value,
          expiresAt: Date.now() + ttlMs,
          promise: null,
        });
      }
      return value;
    })
    .catch((error) => {
      if (sharedGetCache.get(path)?.promise === promise) {
        if (cached?.value !== undefined) {
          sharedGetCache.set(path, { ...cached, promise: null });
        } else {
          sharedGetCache.delete(path);
        }
      }
      throw error;
    });

  sharedGetCache.set(path, {
    value: cached?.value,
    expiresAt: cached?.expiresAt || 0,
    promise,
  });
  return promise;
}
