const PRODUCTION_API_BASE_URL = 'https://smartbuyai-react.onrender.com';
const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const RAW_API_BASE_URL = configuredApiBaseUrl
  || (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : '');

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, payload = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.payload = payload;
    if (cause) this.cause = cause;
  }
}

export function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function detailMessage(detail) {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item) => item?.msg || item?.message)
    .filter(Boolean);

  return messages.length > 0 ? messages.join('；') : null;
}

function errorMessage(payload, response) {
  if (typeof payload === 'string' && payload.trim()) return payload;

  if (payload && typeof payload === 'object') {
    return (
      detailMessage(payload.detail)
      || payload.message
      || payload.error
      || null
    );
  }

  return response.statusText || `HTTP ${response.status}`;
}

async function parseResponse(response, mode = 'auto') {
  if (mode === 'none' || response.status === 204) return null;
  if (mode === 'response') return response;
  if (mode === 'text') return response.text();
  if (mode === 'json') return response.json();

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

export async function apiFetch(path, options = {}) {
  const {
    timeoutMs = 0,
    signal: externalSignal,
    credentials = 'include',
    ...fetchOptions
  } = options;

  const controller = timeoutMs > 0 ? new AbortController() : null;
  let timeoutId = null;
  let forwardAbort = null;

  if (controller && externalSignal) {
    forwardAbort = () => controller.abort(externalSignal.reason);
    if (externalSignal.aborted) forwardAbort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  if (controller) {
    timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await fetch(buildApiUrl(path), {
      credentials,
      ...fetchOptions,
      signal: controller?.signal ?? externalSignal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
      throw new ApiError(`資料來源超過 ${seconds} 秒未回應`, { cause: error });
    }
    throw error;
  } finally {
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    if (externalSignal && forwardAbort) {
      externalSignal.removeEventListener('abort', forwardAbort);
    }
  }
}

export async function apiRequest(path, options = {}) {
  const {
    json,
    parse = 'auto',
    headers: inputHeaders,
    ...fetchOptions
  } = options;

  const headers = new Headers(inputHeaders || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  let body = fetchOptions.body;
  if (json !== undefined) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const response = await apiFetch(path, {
    ...fetchOptions,
    headers,
    body,
  });

  if (!response.ok) {
    const payload = await parseResponse(response, 'auto');
    throw new ApiError(errorMessage(payload, response), {
      status: response.status,
      detail: payload?.detail ?? null,
      payload,
    });
  }

  return parseResponse(response, parse);
}
