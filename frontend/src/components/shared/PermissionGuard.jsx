import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

export default function PermissionGuard({ permission, children }) {
  const { permissions = [] } = useAuth();
  const location = useLocation();

  if (!permission || !permissions.includes(permission)) {
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
