import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import MobileBottomNav from '../components/public/MobileBottomNav';
import PublicHeader from '../components/public/PublicHeader';
import PublicSidebar from '../components/public/PublicSidebar';
import Drawer from '../components/shared/Drawer';
import { useAuth } from '../context/AuthContext';
import { DASHBOARD_NAV_LINK, PUBLIC_MOBILE_LINKS } from '../config/publicNavigation';
import useLayoutMode from '../hooks/useLayoutMode';

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { layoutMode } = useLayoutMode();
  const { user, dashboardAccess } = useAuth();
  const currentRole = dashboardAccess?.role || user?.role;
  const hasDashboardRole = ['admin', 'farmer', 'merchant'].includes(currentRole);
  const menuLinks = dashboardAccess?.dashboardAccess || hasDashboardRole
    ? [...PUBLIC_MOBILE_LINKS, DASHBOARD_NAV_LINK]
    : PUBLIC_MOBILE_LINKS;

  useEffect(() => {
    setSidebarCollapsed(layoutMode === 'tablet');
  }, [layoutMode]);

  return (
    <div className={`public-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <PublicSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
      <PublicHeader onMenu={() => setMenuOpen(true)} />

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="SmartBuy AI 選單"
      >
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
