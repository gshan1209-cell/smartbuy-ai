const LS_KEY = 'smartbuy_saved_post_ids';

export function loadSavedPostIds() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

export function toggleSavedPostId(id) {
  const ids = loadSavedPostIds();
  const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  return next;
}
