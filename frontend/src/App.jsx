import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/shared/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import PublicLayout from './layouts/PublicLayout';
import AgriNews from './pages/AgriNews';
import DashboardOverview from './pages/dashboard/DashboardOverview';
import Home from './pages/Home';
import Login from './pages/Login';
import MutualAid from './pages/MutualAid';
import MyBasket from './pages/MyBasket';
import Placeholder from './pages/Placeholder';
import PriceSearch from './pages/PriceSearch';
import ProductDetail from './pages/ProductDetail';
import Register from './pages/Register';
import Settings from './pages/Settings';

const dashboardModules = {
  prices: '行情管理',
  products: '商品管理',
  predictions: 'AI 預測監控',
  weather: '天氣風險',
  seasonal: '節氣推薦',
  content: '內容管理',
  'mutual-aid': '互助網管理',
  members: '會員管理',
  notifications: '通知管理',
  'data-jobs': '資料任務監控',
  settings: '系統設定',
};

export default function App() {
  useEffect(() => {
    try {
      const preferences = JSON.parse(
        localStorage.getItem('smartbuy_display_prefs') || '{}',
      );
      document.documentElement.setAttribute(
        'data-theme',
        preferences.theme || 'light',
      );
    } catch {
      // Ignore malformed legacy preferences.
    }
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<PriceSearch />} />
          <Route path="/product/:name" element={<ProductDetail />} />
          <Route path="/basket" element={<MyBasket />} />
          <Route path="/news" element={<AgriNews />} />
          <Route path="/mutual-aid" element={<MutualAid />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/alerts" element={<Placeholder title="提醒中心" />} />
          <Route
            path="/season"
            element={<Placeholder title="節氣與當季推薦" />}
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardOverview />} />
            {Object.entries(dashboardModules).map(([key, title]) => (
              <Route
                key={key}
                path={key}
                element={<Placeholder title={title} />}
              />
            ))}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
