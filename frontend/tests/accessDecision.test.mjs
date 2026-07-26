import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProtectedRouteDecision,
  hasPermission,
  PROTECTED_ROUTE_DECISION,
} from '../src/lib/accessDecision.js';

test('unauthenticated users are redirected before any dashboard state is trusted', () => {
  assert.equal(
    getProtectedRouteDecision({
      isAuthenticated: false,
      authLoading: true,
      dashboardAccess: { dashboardAccess: true },
      accessDenied: false,
      accessError: null,
    }),
    PROTECTED_ROUTE_DECISION.LOGIN,
  );
});

test('authenticated users see a loading state while access is being checked', () => {
  assert.equal(
    getProtectedRouteDecision({
      isAuthenticated: true,
      authLoading: true,
      dashboardAccess: null,
      accessDenied: false,
      accessError: null,
    }),
    PROTECTED_ROUTE_DECISION.LOADING,
  );
});

test('access service errors fail closed', () => {
  assert.equal(
    getProtectedRouteDecision({
      isAuthenticated: true,
      authLoading: false,
      dashboardAccess: { dashboardAccess: true },
      accessDenied: false,
      accessError: new Error('service unavailable'),
    }),
    PROTECTED_ROUTE_DECISION.ERROR,
  );
});

test('explicit denial and missing positive access both return forbidden', () => {
  const base = {
    isAuthenticated: true,
    authLoading: false,
    accessError: null,
  };

  assert.equal(
    getProtectedRouteDecision({
      ...base,
      dashboardAccess: { dashboardAccess: true },
      accessDenied: true,
    }),
    PROTECTED_ROUTE_DECISION.FORBIDDEN,
  );

  assert.equal(
    getProtectedRouteDecision({
      ...base,
      dashboardAccess: null,
      accessDenied: false,
    }),
    PROTECTED_ROUTE_DECISION.FORBIDDEN,
  );
});

test('dashboard route is allowed only with an explicit positive access result', () => {
  assert.equal(
    getProtectedRouteDecision({
      isAuthenticated: true,
      authLoading: false,
      dashboardAccess: { dashboardAccess: true },
      accessDenied: false,
      accessError: null,
    }),
    PROTECTED_ROUTE_DECISION.ALLOW,
  );
});

test('permission checks deny missing, empty, or unknown permissions', () => {
  assert.equal(hasPermission(['prices.view'], 'prices.view'), true);
  assert.equal(hasPermission(['prices.view'], 'coupons.manage'), false);
  assert.equal(hasPermission([], 'prices.view'), false);
  assert.equal(hasPermission(null, 'prices.view'), false);
  assert.equal(hasPermission(['prices.view'], ''), false);
});
