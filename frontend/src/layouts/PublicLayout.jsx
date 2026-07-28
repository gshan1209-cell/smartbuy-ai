import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import IdentityRoleSelect from '../components/public/IdentityRoleSelect';
import MobileBottomNav from '../components/public/MobileBottomNav';
import PublicHeader from '../components/public/PublicHeader';
import PublicSidebar from '../components/public/PublicSidebar';
import Drawer from '../components/shared/Drawer';
import {
  ALL_PUBLIC_NAV_LINKS,
  DASHBOARD_NAV_LINK,
  PUBLIC_MOBILE_LINKS,
} from '../config/publicNavigation';
import { IS_TEST_MODE } from '../config/testMode';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, dashboardAccess } = useAuth();
  const currentRole = dashboardAccess?.role || user?.role;
  const hasDashboardRole = ['admin', 'farmer', 'merchant'].includes(currentRole);
  const menuLinks = IS_TEST_MODE
    ? [...ALL_PUBLIC_NAV_LINKS, DASHBOARD_NAV_LINK]
    : dashboardAccess?.dashboardAccess || hasDashboardRole
      ? [...PUBLIC_MOBILE_LINKS, DASHBOARD_NAV_LINK]
      : PUBLIC_MOBILE_LINKS;

  return (
    <div className={`public-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <PublicSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
      <PublicHeader onMenu={() => setMenuOpen(true)} />

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="SmartBuy AI 選單"
      >
        <IdentityRoleSelect className="drawer-identity-role" />
        <nav className="public-drawer-nav" aria-label="手機版主要選單">
          {menuLinks.map(({ to, label, description }) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} title={description} aria-label={description}>
              {label}
            </NavLink>
          ))}
        </nav>
      </Drawer>

      <main className="app-main">
        <Outlet />
      </main>

      <MobileBottomNav />
    </div>
  );
}
