import { useEffect, useState } from 'react';

import { apiRequest } from '../lib/apiClient.js';

const sharedGetCache = new Map();

export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiRequest(path, { signal: controller.signal })
      .then(setData)
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') setError(requestError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [path]);

  return { data, loading, error };
}

export function post(path, body) {
  return apiRequest(path, { method: 'POST', json: body });
}

export function put(path, body) {
  return apiRequest(path, { method: 'PUT', json: body });
}

export function patch(path, body) {
  return apiRequest(path, { method: 'PATCH', json: body });
}

export function remove(path) {
  return apiRequest(path, { method: 'DELETE' });
}

export function get(path, { timeoutMs = 8000, signal } = {}) {
  // Live agriculture endpoints must not be served from the browser's HTTP
  // cache.  getCached() still provides an explicit, short-lived app cache for
  // content that opts into it; normal price reads always reach the API.
  return apiRequest(path, { timeoutMs, signal, cache: 'no-store' });
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
    .catch((requestError) => {
      if (sharedGetCache.get(path)?.promise === promise) {
        if (cached?.value !== undefined) {
          sharedGetCache.set(path, { ...cached, promise: null });
        } else {
          sharedGetCache.delete(path);
        }
      }
      throw requestError;
    });

  sharedGetCache.set(path, {
    value: cached?.value,
    expiresAt: cached?.expiresAt || 0,
    promise,
  });
  return promise;
}
