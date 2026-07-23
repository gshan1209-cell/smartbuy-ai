import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

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

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (authLoading) {
    return <div className="dashboard-loading">正在確認後台權限…</div>;
  }

  if (accessError) {
    return (
      <div className="dashboard-loading dashboard-access-error" role="alert">
        <p>權限服務暫時無法取得，未開放任何後台內容。</p>
        <small>{accessError.message}</small>
        <button type="button" onClick={refreshSession}>重新確認權限</button>
      </div>
    );
  }

  if (accessDenied || dashboardAccess?.dashboardAccess !== true) {
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
