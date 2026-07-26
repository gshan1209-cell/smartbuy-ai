import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { BYPASS_ROLE_CHECKS_IN_DEV } from '../../config/development';

export default function PermissionGuard({ permission, children }) {
  const { permissions = [] } = useAuth();
  const location = useLocation();

  if (!BYPASS_ROLE_CHECKS_IN_DEV && (!permission || !permissions.includes(permission))) {
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
