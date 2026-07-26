import {
  Coins,
  Gift,
  Home,
  LayoutDashboard,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
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

const ACTION_ICONS = {
  refresh: RefreshCw,
};

function resolveSidebarPath(to, location) {
  if (to === '__current__') return `${location.pathname}${location.search}${location.hash}`;
  if (to.startsWith('__current__')) {
    const suffix = to.slice('__current__'.length);
    const [query = '', hash = ''] = suffix.split('#');
    const currentParams = new URLSearchParams(location.search);
    const nextParams = new URLSearchParams(query.replace(/^\?/, ''));
    nextParams.forEach((value, key) => currentParams.set(key, value));
    const nextQuery = currentParams.toString();
    return `${location.pathname}${nextQuery ? `?${nextQuery}` : ''}${hash ? `#${hash}` : ''}`;
  }
  return to;
}

function SidebarLink({ link, location, locationHref }) {
  const Icon = ICONS[link.to.split('?')[0].split('#')[0]] || Gift;
  const href = resolveSidebarPath(link.to, location);
  const isCurrent = href === locationHref;

  return (
    <NavLink
      to={href}
      className={`public-sidebar-link${isCurrent ? ' active' : ''}`}
      title={link.description}
      aria-label={link.description}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="public-sidebar-label">{link.label}</span>
    </NavLink>
  );
}

function SidebarAction({ action }) {
  const Icon = ACTION_ICONS[action.icon] || RefreshCw;

  return (
    <button
      type="button"
      className="public-sidebar-link"
      onClick={() => window.dispatchEvent(new CustomEvent('smartbuy:sidebar-action', { detail: { action: action.action } }))}
      title={action.description}
      aria-label={action.description}
    >
      <Icon size={19} aria-hidden="true" />
      <span className="public-sidebar-label">{action.label}</span>
    </button>
  );
}

export default function PublicSidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { pathname } = location;
  const locationHref = `${location.pathname}${location.search}${location.hash}`;
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
      {sidebarContext.description && (
        <p className="public-sidebar-context-description">{sidebarContext.description}</p>
      )}

      {sidebarContext.sections.map(section => (
        <nav key={section.heading} className="public-sidebar-nav" aria-label={section.heading}>
          <p className="public-sidebar-heading">{section.heading}</p>
          {section.links.map(link => (
            <SidebarLink key={`${section.heading}-${link.to}-${link.label}`} link={link} location={location} locationHref={locationHref} />
          ))}
        </nav>
      ))}

      {sidebarContext.actions?.length > 0 && (
        <nav className="public-sidebar-nav" aria-label="頁面操作">
          <p className="public-sidebar-heading">頁面操作</p>
          {sidebarContext.actions.map(action => (
            <SidebarAction key={action.action} action={action} />
          ))}
        </nav>
      )}

      {canAccessDashboard && (
        <nav className="public-sidebar-nav public-sidebar-secondary" aria-label="管理入口">
          <p className="public-sidebar-heading">管理入口</p>
          <SidebarLink link={DASHBOARD_NAV_LINK} location={location} locationHref={locationHref} />
        </nav>
      )}
    </aside>
  );
}
