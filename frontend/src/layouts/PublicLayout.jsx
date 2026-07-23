import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import MobileBottomNav from '../components/public/MobileBottomNav';
import PublicHeader from '../components/public/PublicHeader';

export default function PublicLayout() {
  const [menu, setMenu] = useState(false);
  return <div className="public-layout">
    <PublicHeader onMenu={() => setMenu((value) => !value)} />
    {menu && <div className="mobile-menu" role="menu">
      <NavLink to="/news" onClick={() => setMenu(false)}>農產新知</NavLink>
      <NavLink to="/mutual-aid" onClick={() => setMenu(false)}>互助網</NavLink>
      <NavLink to="/settings" onClick={() => setMenu(false)}>個人設定</NavLink>
    </div>}
    <main className="app-main"><Outlet /></main>
    <MobileBottomNav />
  </div>;
}
