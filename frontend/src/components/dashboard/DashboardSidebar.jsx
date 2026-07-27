import { NavLink, Link } from 'react-router-dom';
import { Sprout, ArrowLeftFromLine } from 'lucide-react';

import { dashboardNavigation } from '../../config/dashboardNavigation';
import { ROLES } from '../../config/roles';
import { useAuth } from '../../context/AuthContext';
import { BYPASS_ROLE_CHECKS_IN_DEV } from '../../config/development';

export { dashboardNavigation };

export default function DashboardSidebar({ collapsed = false, onNavigate }) {
  const { permissions = [], user } = useAuth();
  const visibleNavigation = dashboardNavigation.filter((item) =>
    (BYPASS_ROLE_CHECKS_IN_DEV || permissions.includes(item.permission))
      && (!item.roles || BYPASS_ROLE_CHECKS_IN_DEV || item.roles.includes(user?.role)),
  );
  const roleLabel = ROLES[user?.role] || ROLES.consumer;

  return (
    <aside className={`dashboard-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="dashboard-brand">
        <Sprout size={22} aria-hidden="true" />
        <span>SmartBuy AI 管理後台</span>
      </div>

      <nav className="dashboard-navigation" aria-label="後台主要導覽">
        {visibleNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            end={to.endsWith('/overview')}
            title={collapsed ? label : undefined}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dashboard-sidebar-footer">
        <small>目前角色</small>
        <strong>{roleLabel}</strong>
      </div>
    </aside>
  );
}
