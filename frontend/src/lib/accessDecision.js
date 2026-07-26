export const PROTECTED_ROUTE_DECISION = Object.freeze({
  LOGIN: 'login',
  LOADING: 'loading',
  ERROR: 'error',
  FORBIDDEN: 'forbidden',
  ALLOW: 'allow',
});

export function getProtectedRouteDecision({
  isAuthenticated,
  authLoading,
  dashboardAccess,
  accessDenied,
  accessError,
}) {
  if (!isAuthenticated) return PROTECTED_ROUTE_DECISION.LOGIN;
  if (authLoading) return PROTECTED_ROUTE_DECISION.LOADING;
  if (accessError) return PROTECTED_ROUTE_DECISION.ERROR;
  if (accessDenied || dashboardAccess?.dashboardAccess !== true) {
    return PROTECTED_ROUTE_DECISION.FORBIDDEN;
  }
  return PROTECTED_ROUTE_DECISION.ALLOW;
}

export function hasPermission(permissions, permission) {
  return Boolean(permission)
    && Array.isArray(permissions)
    && permissions.includes(permission);
}
