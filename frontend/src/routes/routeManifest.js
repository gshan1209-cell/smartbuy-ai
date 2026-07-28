export const ROUTE_FALLBACK = '*';
export const DASHBOARD_ROOT = '/dashboard';

export const PUBLIC_ROUTES = Object.freeze({
  HOME: '/',
  RECOMMENDATIONS: '/recommendations',
  SEARCH: '/search',
  PRODUCT_DETAIL: '/product/:name',
  BASKET: '/basket',
  NEWS: '/news',
  SPECIAL_OFFERS: '/special-offers',
  INFORMATION_SHARING: '/information-sharing',
  POINTS: '/points',
  MUTUAL_AID: '/mutual-aid',
  SETTINGS: '/settings',
  ALERTS: '/alerts',
  SEASON: '/season',
  LOGIN: '/login',
  REGISTER: '/register',
  FORBIDDEN: '/403',
});

export const DASHBOARD_ROUTES = Object.freeze({
  OVERVIEW: 'overview',
  PRICES: 'prices',
  PREDICTIONS: 'predictions',
  RECOMMENDATIONS: 'recommendations',
  WEATHER: 'weather',
  SEASONAL: 'seasonal',
  COUPONS: 'coupons',
});

export function getPublicRoutePaths() {
  return Object.values(PUBLIC_ROUTES);
}

export function getDashboardRoutePaths() {
  return Object.values(DASHBOARD_ROUTES);
}
