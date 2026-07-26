import {
  Coins,
  Gift,
  Home,
  LayoutDashboard,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShoppingBasket,
  Tag,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DASHBOARD_NAV_LINK } from '../../config/publicNavigation';
import { getPublicSidebarContext } from '../../config/publicSidebarContexts';

const ICONS = {
  '/': Home,
  '/search': Search,
  '/basket': ShoppingBasket,
  '/news': Newspaper,
  '/special-offers': Tag,
  '/mutual-aid': Gift,
  '/points': Coins,
  '/settings': Settings,
  '/dashboard': LayoutDashboard,
};

function SidebarLink({ link }) {
  const Icon = ICONS[link.to] || Gift;

  return (
    <NavLink
      to={link.to}
      end={link.to === '/'}
      className="public-sidebar-link"
      title={link.description}
      aria-label={link.description}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="public-sidebar-label">{link.label}</span>
    </NavLink>
  );
}

export default function PublicSidebar({ collapsed, onToggle }) {
  const { pathname } = useLocation();
  const { user, isAuthenticated, dashboardAccess } = useAuth();
  const currentRole = dashboardAccess?.role || user?.role;
  const hasDashboardRole = ['admin', 'farmer', 'merchant'].includes(currentRole);
  const canAccessDashboard = isAuthenticated && (dashboardAccess?.dashboardAccess || hasDashboardRole);
  const sidebarContext = getPublicSidebarContext(pathname);

  return (
    <aside className={`public-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label={`${sidebarContext.title}側欄`}>
      <div className="public-sidebar-brand">
        <NavLink to="/" className="public-sidebar-logo" aria-label="回到 SmartBuy AI 首頁">
          <span className="public-sidebar-logo-mark" aria-hidden="true">S</span>
          <span className="public-sidebar-label">SmartBuy AI</span>
        </NavLink>
        <button
          type="button"
          className="public-sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? '展開側欄' : '收合側欄'}
          title={collapsed ? '展開側欄' : '收合側欄'}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="public-sidebar-context-title">{sidebarContext.title}</div>

      {sidebarContext.sections.map(section => (
        <nav key={section.heading} className="public-sidebar-nav" aria-label={section.heading}>
          <p className="public-sidebar-heading">{section.heading}</p>
          {section.links.map(link => (
            <SidebarLink key={`${section.heading}-${link.to}-${link.label}`} link={link} />
          ))}
        </nav>
      ))}

      {canAccessDashboard && (
        <nav className="public-sidebar-nav public-sidebar-secondary" aria-label="管理入口">
          <p className="public-sidebar-heading">管理入口</p>
          <SidebarLink link={DASHBOARD_NAV_LINK} />
        </nav>
      )}
    </aside>
  );
}
