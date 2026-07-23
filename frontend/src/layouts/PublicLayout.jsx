import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import MobileBottomNav from '../components/public/MobileBottomNav';
import PublicHeader from '../components/public/PublicHeader';
import Drawer from '../components/shared/Drawer';
import { useAuth } from '../context/AuthContext';

const mobileMenuLinks = [
  ['/news', '農產新知'],
  ['/mutual-aid', '互助網'],
  ['/settings', '個人設定'],
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { dashboardAccess } = useAuth();
  const menuLinks = dashboardAccess?.dashboardAccess
    ? [...mobileMenuLinks, ['/dashboard', '後台']]
    : mobileMenuLinks;

  return (
    <div className="public-layout">
      <PublicHeader onMenu={() => setMenuOpen(true)} />

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="SmartBuy AI 選單"
      >
        <nav className="public-drawer-nav" aria-label="手機版主要選單">
          {menuLinks.map(([to, label]) => (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>
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
