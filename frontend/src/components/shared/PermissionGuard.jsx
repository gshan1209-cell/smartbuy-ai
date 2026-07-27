import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { IS_TEST_MODE } from '../../config/testMode';
import { hasPermission } from '../../lib/accessDecision';

export default function PermissionGuard({ permission, children }) {
  const { permissions = [] } = useAuth();
  const location = useLocation();

  if (IS_TEST_MODE) return children;

  if (!hasPermission(permissions, permission)) {
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
