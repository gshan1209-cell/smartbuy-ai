import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardDrawer from '../components/dashboard/DashboardDrawer';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import DashboardTopbar from '../components/dashboard/DashboardTopbar';

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  return <div className="dashboard-layout">
    <DashboardSidebar />
    <DashboardTopbar onMenu={() => setOpen(true)} />
    <main className="dashboard-content"><Outlet /></main>
    <DashboardDrawer open={open} onClose={() => setOpen(false)} />
  </div>;
}
