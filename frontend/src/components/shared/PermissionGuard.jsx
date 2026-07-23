import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
export default function PermissionGuard({ permission, children }) { const { permissions = [] } = useAuth(); return permissions.includes(permission) ? children : <Navigate to="/403" replace />; }
