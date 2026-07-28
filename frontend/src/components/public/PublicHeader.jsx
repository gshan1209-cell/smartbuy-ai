import { Menu, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { NotificationBell } from '../Navbar';
import {
  DASHBOARD_NAV_LINK,
  POINTS_NAV_LINK,
  PUBLIC_NAV_LINKS,
  SETTINGS_NAV_LINK,
} from '../../config/publicNavigation';
import { useAuth } from '../../context/AuthContext';
import useLayoutMode, { LAYOUT_MODE_OPTIONS } from '../../hooks/useLayoutMode';
import IdentityRoleSelect from './IdentityRoleSelect';

export default function PublicHeader({ onMenu }) {
  const { user, isAuthenticated, dashboardAccess } = useAuth();
  const { layoutMode, updateLayoutMode } = useLayoutMode();
  const links = [...PUBLIC_NAV_LINKS, POINTS_NAV_LINK];
  if (isAuthenticated) links.push(SETTINGS_NAV_LINK);
  const currentRole = dashboardAccess?.role || user?.role;
  const hasDashboardRole = ['admin', 'farmer', 'merchant'].includes(currentRole);
  if (isAuthenticated && (dashboardAccess?.dashboardAccess || hasDashboardRole)) links.push(DASHBOARD_NAV_LINK);

  return (
    <header className="public-header">
      <NavLink className="brand" to="/">🌿 SmartBuy AI</NavLink>
      <nav className="public-nav">
        {links.map(({ to, label, description }) => (
          <NavLink key={to} to={to} end={to === '/'} title={description} aria-label={description}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="header-actions">
        <div className="layout-mode-switch" role="group" aria-label="版面模式">
          {LAYOUT_MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={layoutMode === option.value ? 'active' : ''}
              onClick={() => updateLayoutMode(option.value)}
              title={option.description}
              aria-label={option.description}
              aria-pressed={layoutMode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <IdentityRoleSelect className="header-identity-role" />
        <NavLink className="mobile-icon" aria-label="搜尋" to="/search"><Search size={20} /></NavLink>
        {isAuthenticated && <NotificationBell />}
        {!isAuthenticated && (
          <NavLink className="settings-link" to="/login" title="登入帳戶">
            🔐 登入
          </NavLink>
        )}
        <button className="mobile-icon menu-button" aria-label="開啟選單" onClick={onMenu}><Menu size={22} /></button>
      </div>
    </header>
  );
}
