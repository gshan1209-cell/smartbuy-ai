import { PERMISSIONS } from './permissions.js';

export const IS_TEST_MODE = true;

export const TEST_USER = Object.freeze({
  id: 1,
  name: '訪客',
  email: 'admin@gmail.com',
  role: 'consumer',
});

export const TEST_PERMISSIONS = Object.freeze([
  PERMISSIONS.PRICES_VIEW,
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.PREDICTIONS_VIEW,
  PERMISSIONS.RECOMMENDATIONS_VIEW,
  PERMISSIONS.WEATHER_VIEW,
  PERMISSIONS.SEASONAL_VIEW,
]);
