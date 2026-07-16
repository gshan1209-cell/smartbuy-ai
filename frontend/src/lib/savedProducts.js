const LS_KEY = 'smartbuy_saved_products';

export function loadSavedProducts() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

function persist(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
  return items;
}

export function toggleSavedProduct(name) {
  const items = loadSavedProducts();
  const next = items.includes(name) ? items.filter(n => n !== name) : [...items, name];
  return persist(next);
}

export function removeSavedProduct(name) {
  return persist(loadSavedProducts().filter(n => n !== name));
}
