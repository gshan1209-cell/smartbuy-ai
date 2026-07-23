import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { dashboardNavigation } from './DashboardSidebar';

export default function DashboardTopbar({ onMenu }) {
  const { pathname } = useLocation();
  const title = dashboardNavigation.find(([to]) => to === pathname)?.[1] || '營運總覽';
  return <header className="dashboard-topbar"><button className="dashboard-menu" aria-label="開啟後台選單" onClick={onMenu}><Menu size={22} /></button><div><strong>{title}</strong><span>管理中心 / Dashboard</span></div><span className="demo-label">Demo 環境</span></header>;
}
