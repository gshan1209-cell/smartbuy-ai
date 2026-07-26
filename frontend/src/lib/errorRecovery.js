export const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CHUNK_ERROR_PATTERN.test(message);
}

export function getErrorRecoveryContent(error) {
  if (isChunkLoadError(error)) {
    return {
      title: '網站已更新，請重新載入',
      description: '目前分頁仍使用舊版資源，重新載入即可取得最新版本。',
    };
  }

  return {
    title: '這個畫面暫時無法顯示',
    description: '你的資料與操作不會因此被自動刪除。請重新載入；若問題持續，可先回到首頁使用其他功能。',
  };
}
