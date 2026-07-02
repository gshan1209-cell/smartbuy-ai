const LS_KEY = 'smartbuy_saved_news';

export function loadSavedNews() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

function persist(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
  return items;
}

export function toggleSavedNews(article) {
  const items = loadSavedNews();
  const exists = items.some(a => a.id === article.id);
  const next = exists ? items.filter(a => a.id !== article.id) : [...items, article];
  return persist(next);
}

export function removeSavedNews(id) {
  return persist(loadSavedNews().filter(a => a.id !== id));
}
