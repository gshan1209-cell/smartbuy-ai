import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_ADMIN_ACCESS = import.meta.env.VITE_ENABLE_DEMO_ADMIN === 'true';
const DASHBOARD_ROLES = ['farmer', 'merchant', 'operator', 'admin', 'staff'];

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const hasDashboardRole = DASHBOARD_ROLES.includes(user?.role);

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!hasDashboardRole && !DEMO_ADMIN_ACCESS) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
