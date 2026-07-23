import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, authLoading, dashboardAccess, accessError, refreshSession } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (authLoading) return <div className="dashboard-loading">正在確認權限…</div>;
  if (accessError) return <div className="dashboard-loading"><p>權限服務暫時無法取得。</p><button onClick={refreshSession}>重試</button></div>;
  if (!dashboardAccess?.dashboardAccess) return <Navigate to="/403" replace />;

  return <Outlet />;
}
