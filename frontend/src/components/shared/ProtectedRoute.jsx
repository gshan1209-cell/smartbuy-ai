import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEMO_ADMIN_ACCESS = import.meta.env.VITE_ENABLE_DEMO_ADMIN === 'true';

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const hasRole = ['admin', 'staff', 'operator'].includes(user?.role);
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!hasRole && !DEMO_ADMIN_ACCESS) return <Navigate to="/" replace />;
  return <Outlet />;
}
