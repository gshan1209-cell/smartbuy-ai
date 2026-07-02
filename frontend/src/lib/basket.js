const LS_KEY = 'smartbuy_basket';

export function loadBasket() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

export function saveBasket(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}
