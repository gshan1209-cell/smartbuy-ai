import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { IS_TEST_MODE } from '../../config/testMode';
import { useAuth } from '../../context/AuthContext';
import {
  getProtectedRouteDecision,
  PROTECTED_ROUTE_DECISION,
} from '../../lib/accessDecision';

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    authLoading,
    dashboardAccess,
    accessDenied,
    accessError,
    refreshSession,
  } = useAuth();
  const location = useLocation();


  const decision = getProtectedRouteDecision({
    isAuthenticated,
    authLoading,
    dashboardAccess,
    accessDenied,
    accessError,
  });

  if (decision === PROTECTED_ROUTE_DECISION.LOGIN) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (decision === PROTECTED_ROUTE_DECISION.LOADING) {
    return <div className="dashboard-loading">正在確認後台權限…</div>;
  }

  if (decision === PROTECTED_ROUTE_DECISION.ERROR) {
    return (
      <div className="dashboard-loading dashboard-access-error" role="alert">
        <p>權限服務暫時無法取得，未開放任何後台內容。</p>
        <small>{accessError.message}</small>
        <button type="button" onClick={refreshSession}>重新確認權限</button>
      </div>
    );
  }

  if (decision === PROTECTED_ROUTE_DECISION.FORBIDDEN) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
