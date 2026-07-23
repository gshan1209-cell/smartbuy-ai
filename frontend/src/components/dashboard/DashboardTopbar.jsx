import { Menu, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { ROLES } from '../../config/roles';
import { useAuth } from '../../context/AuthContext';
import { dashboardNavigation } from './DashboardSidebar';

export default function DashboardTopbar({ onMenu }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const currentItem = dashboardNavigation.find(({ to }) => to === pathname);
  const title = currentItem?.label || '營運總覽';
  const roleLabel = ROLES[user?.role] || ROLES.consumer;

  return (
    <header className="dashboard-topbar">
      <button
        type="button"
        className="dashboard-menu"
        aria-label="開啟後台選單"
        onClick={onMenu}
      >
        <Menu size={22} />
      </button>

      <div className="dashboard-topbar-title">
        <strong>{title}</strong>
        <span>管理中心 / Dashboard</span>
      </div>

      <span className="dashboard-role-chip">
        <ShieldCheck size={16} aria-hidden="true" />
        {roleLabel}
      </span>
    </header>
  );
}
