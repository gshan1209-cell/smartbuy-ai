import { NavLink } from 'react-router-dom';
import { dashboardNavigation } from '../../config/dashboardNavigation';
import { useAuth } from '../../context/AuthContext';
export { dashboardNavigation };
export default function DashboardSidebar({ collapsed = false, onNavigate }) { const { permissions = [], user } = useAuth(); const visible = dashboardNavigation.filter(([, , permission]) => permissions.includes(permission)); return <aside className={`dashboard-sidebar ${collapsed ? 'is-collapsed' : ''}`}><div className="dashboard-brand">▦ <span>SmartBuy AI 管理後台</span></div>{visible.map(([to, label]) => <NavLink key={to} to={to} onClick={onNavigate} end={to.endsWith('overview')}>▣ <span>{label}</span></NavLink>)}<small className="dashboard-role">{user?.role === 'admin' ? '系統管理員' : user?.role === 'farmer' ? '農民' : '商家'}</small></aside>; }
