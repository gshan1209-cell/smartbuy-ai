import { get } from '../hooks/useApi.js';

// Render 冷啟動偶爾會超過一般 8 秒讀取上限。菜籃只發出一筆行情清單請求，
// 因此可在此頁使用較長等待時間，不影響全站其他即時讀取。
export const BASKET_PRODUCTS_TIMEOUT_MS = 20_000;

export function selectFavoriteProduct(favorite, products) {
  const matches = products.filter((item) => item.product_name === favorite.name);
  return matches.find((item) => item.market_name === favorite.market) || matches[0] || null;
}

export async function loadBasketProductDetails(
  favorites,
  { fetcher = get } = {},
) {
  try {
    const products = await fetcher('/api/products', {
      timeoutMs: BASKET_PRODUCTS_TIMEOUT_MS,
    });
    if (!Array.isArray(products)) throw new TypeError('行情資料格式不正確');

    return Object.fromEntries(favorites.map((favorite) => {
      const summary = selectFavoriteProduct(favorite, products);
      if (!summary) {
        return [favorite.name, {
          dataState: 'missing',
          market_name: favorite.market,
        }];
      }
      return [favorite.name, {
        ...summary,
        price_detail: summary,
        dataState: 'ready',
      }];
    }));
  } catch (error) {
    return Object.fromEntries(favorites.map((favorite) => [favorite.name, {
      dataState: 'unavailable',
      market_name: favorite.market,
      errorMessage: error?.message || '行情服務暫時無法使用',
    }]));
  }
}
