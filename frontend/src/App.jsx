import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import ScrollToTop from './components/ScrollToTop';
import PermissionGuard from './components/shared/PermissionGuard';
import ProtectedRoute from './components/shared/ProtectedRoute';
import { PERMISSIONS } from './config/permissions';
import DashboardLayout from './layouts/DashboardLayout';
import PublicLayout from './layouts/PublicLayout';
import AgriNews from './pages/AgriNews';
import Alerts from './pages/Alerts';
import DashboardOverview from './pages/dashboard/DashboardOverview';
import DashboardPrices from './pages/dashboard/DashboardPrices';
import ForbiddenPage from './pages/ForbiddenPage';
import Home from './pages/Home';
import Login from './pages/Login';
import MutualAid from './pages/MutualAid';
import MyBasket from './pages/MyBasket';
import Placeholder from './pages/Placeholder';
import PriceSearch from './pages/PriceSearch';
import ProductDetail from './pages/ProductDetail';
import Register from './pages/Register';
import Season from './pages/Season';
import Settings from './pages/Settings';

const dashboardModules = {
  products: { title: '商品管理', permission: PERMISSIONS.PRODUCTS_VIEW },
  predictions: { title: 'AI 預測監控', permission: PERMISSIONS.PREDICTIONS_VIEW },
  weather: { title: '天氣風險', permission: PERMISSIONS.WEATHER_VIEW },
  seasonal: { title: '節氣推薦', permission: PERMISSIONS.SEASONAL_VIEW },
  content: { title: '內容管理', permission: PERMISSIONS.CONTENT_MANAGE },
  'mutual-aid': { title: '互助網管理', permission: PERMISSIONS.MUTUAL_AID_MANAGE },
  members: { title: '會員管理', permission: PERMISSIONS.MEMBERS_MANAGE },
  notifications: { title: '通知管理', permission: PERMISSIONS.NOTIFICATIONS_MANAGE },
  'data-jobs': { title: '資料任務監控', permission: PERMISSIONS.DATA_JOBS_VIEW },
  settings: { title: '系統設定', permission: PERMISSIONS.SYSTEM_MANAGE },
};

function GuardedModule({ permission, children }) {
  return <PermissionGuard permission={permission}>{children}</PermissionGuard>;
}

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
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/season" element={<Season />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/403" element={<ForbiddenPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route
              path="overview"
              element={(
                <GuardedModule permission={PERMISSIONS.DASHBOARD_VIEW}>
                  <DashboardOverview />
                </GuardedModule>
              )}
            />
            <Route
              path="prices"
              element={(
                <GuardedModule permission={PERMISSIONS.PRICES_VIEW}>
                  <DashboardPrices />
                </GuardedModule>
              )}
            />
            {Object.entries(dashboardModules).map(([key, config]) => (
              <Route
                key={key}
                path={key}
                element={(
                  <GuardedModule permission={config.permission}>
                    <Placeholder title={config.title} />
                  </GuardedModule>
                )}
              />
            ))}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
