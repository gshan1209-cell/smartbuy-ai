import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DASHBOARD_ROOT,
  DASHBOARD_ROUTES,
  getDashboardRoutePaths,
  getPublicRoutePaths,
  PUBLIC_ROUTES,
  ROUTE_FALLBACK,
} from '../src/routes/routeManifest.js';

test('public route contract preserves all primary user journeys', () => {
  assert.deepEqual(
    getPublicRoutePaths().sort(),
    [
      '/',
      '/403',
      '/alerts',
      '/basket',
      '/information-sharing',
      '/login',
      '/mutual-aid',
      '/news',
      '/points',
      '/product/:name',
      '/register',
      '/search',
      '/season',
      '/settings',
      '/special-offers',
    ].sort(),
  );
});

test('dashboard route contract preserves current modules', () => {
  assert.equal(DASHBOARD_ROOT, '/dashboard');
  assert.deepEqual(
    getDashboardRoutePaths().sort(),
    [
      'coupons',
      'overview',
      'predictions',
      'prices',
      'recommendations',
      'seasonal',
      'weather',
    ].sort(),
  );
});

test('route paths are unique and use the expected nesting form', () => {
  const publicPaths = getPublicRoutePaths();
  const dashboardPaths = getDashboardRoutePaths();

  assert.equal(new Set(publicPaths).size, publicPaths.length);
  assert.equal(new Set(dashboardPaths).size, dashboardPaths.length);
  assert.equal(publicPaths.every(path => path.startsWith('/')), true);
  assert.equal(dashboardPaths.every(path => !path.startsWith('/')), true);
});

test('404 fallback and critical named routes cannot silently disappear', () => {
  assert.equal(ROUTE_FALLBACK, '*');
  assert.equal(PUBLIC_ROUTES.SEARCH, '/search');
  assert.equal(PUBLIC_ROUTES.POINTS, '/points');
  assert.equal(PUBLIC_ROUTES.FORBIDDEN, '/403');
  assert.equal(DASHBOARD_ROUTES.RECOMMENDATIONS, 'recommendations');
  assert.equal(DASHBOARD_ROUTES.COUPONS, 'coupons');
});
