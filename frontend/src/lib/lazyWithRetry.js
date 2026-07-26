import { lazy } from 'react';

import { isChunkLoadError } from './errorRecovery';

const RETRY_PREFIX = 'smartbuy:lazy-retry:';

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getBrowserReload() {
  if (typeof window === 'undefined') return null;
  return () => window.location.reload();
}

function readRetryFlag(storage, key) {
  if (!storage) return { available: false, value: null };
  try {
    return {
      available: true,
      value: storage.getItem(`${RETRY_PREFIX}${key}`),
    };
  } catch {
    return { available: false, value: null };
  }
}

function writeRetryFlag(storage, key, value) {
  if (!storage) return false;
  try {
    if (value === null) {
      storage.removeItem(`${RETRY_PREFIX}${key}`);
    } else {
      storage.setItem(`${RETRY_PREFIX}${key}`, value);
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadModuleWithRecovery(importer, key, runtime = {}) {
  const storage = Object.hasOwn(runtime, 'storage') ? runtime.storage : getBrowserStorage();
  const reload = Object.hasOwn(runtime, 'reload') ? runtime.reload : getBrowserReload();

  try {
    const loadedModule = await importer();
    writeRetryFlag(storage, key, null);
    return { status: 'loaded', module: loadedModule };
  } catch (error) {
    const retryState = readRetryFlag(storage, key);
    const alreadyRetried = retryState.value === '1';

    if (
      isChunkLoadError(error)
      && retryState.available
      && !alreadyRetried
      && typeof reload === 'function'
      && writeRetryFlag(storage, key, '1')
    ) {
      reload();
      return { status: 'reloading' };
    }

    writeRetryFlag(storage, key, null);
    return { status: 'error', error };
  }
}

/**
 * React.lazy wrapper that recovers once from stale deployment chunks.
 *
 * When a user keeps an older tab open after a new Vercel deployment, the old
 * hashed chunk may no longer exist. Reload once to obtain the latest HTML and
 * asset manifest; repeated failures are surfaced to AppErrorBoundary instead
 * of entering a reload loop. If sessionStorage is unavailable, no automatic
 * reload is attempted because a one-time retry cannot be guaranteed safely.
 */
export default function lazyWithRetry(importer, key) {
  return lazy(async () => {
    const result = await loadModuleWithRecovery(importer, key);

    if (result.status === 'loaded') return result.module;
    if (result.status === 'reloading') return new Promise(() => {});
    throw result.error;
  });
}
