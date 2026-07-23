import { Navigate, useLocation } from 'react-router-dom';

import { normalizeRole } from '../../config/roles';
import { useAuth } from '../../context/AuthContext';

export default function RoleGuard({ roles = [], children }) {
  const { user } = useAuth();
  const location = useLocation();
  const currentRole = normalizeRole(user?.role);

  if (!roles.includes(currentRole)) {
    return (
      <Navigate
        to="/403"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
