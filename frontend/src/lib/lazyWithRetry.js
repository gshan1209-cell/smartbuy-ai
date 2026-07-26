import { lazy } from 'react';

const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
const RETRY_PREFIX = 'smartbuy:lazy-retry:';

function readRetryFlag(key) {
  try {
    return window.sessionStorage.getItem(`${RETRY_PREFIX}${key}`);
  } catch {
    return null;
  }
}

function writeRetryFlag(key, value) {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(`${RETRY_PREFIX}${key}`);
    } else {
      window.sessionStorage.setItem(`${RETRY_PREFIX}${key}`, value);
    }
  } catch {
    // sessionStorage may be disabled. The normal Error Boundary remains available.
  }
}

/**
 * React.lazy wrapper that recovers once from stale deployment chunks.
 *
 * When a user keeps an older tab open after a new Vercel deployment, the old
 * hashed chunk may no longer exist. Reload once to obtain the latest HTML and
 * asset manifest; repeated failures are surfaced to AppErrorBoundary instead
 * of entering a reload loop.
 */
export default function lazyWithRetry(importer, key) {
  return lazy(async () => {
    try {
      const loadedModule = await importer();
      writeRetryFlag(key, null);
      return loadedModule;
    } catch (error) {
      const isChunkLoadError = CHUNK_ERROR_PATTERN.test(String(error?.message || error));
      const alreadyRetried = readRetryFlag(key) === '1';

      if (isChunkLoadError && !alreadyRetried && typeof window !== 'undefined') {
        writeRetryFlag(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      writeRetryFlag(key, null);
      throw error;
    }
  });
}
