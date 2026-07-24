import { Navigate, Route, Routes } from 'react-router-dom';

import PermissionGuard from '../components/shared/PermissionGuard';
import ProtectedRoute from '../components/shared/ProtectedRoute';
import { DASHBOARD_PLACEHOLDER_MODULES } from '../config/dashboardModules';
import { PERMISSIONS } from '../config/permissions';
import DashboardLayout from '../layouts/DashboardLayout';
import PublicLayout from '../layouts/PublicLayout';
import AgriNews from '../pages/AgriNews';
import Alerts from '../pages/Alerts';
import DashboardOverview from '../pages/dashboard/DashboardOverview';
import DashboardPredictions from '../pages/dashboard/DashboardPredictions';
import DashboardPrices from '../pages/dashboard/DashboardPrices';
import DashboardSeasonal from '../pages/dashboard/DashboardSeasonal';
import DashboardWeather from '../pages/dashboard/DashboardWeather';
import ForbiddenPage from '../pages/ForbiddenPage';
import Home from '../pages/Home';
import Login from '../pages/Login';
import MutualAid from '../pages/MutualAid';
import MyBasket from '../pages/MyBasket';
import Placeholder from '../pages/Placeholder';
import PriceSearch from '../pages/PriceSearch';
import ProductDetail from '../pages/ProductDetail';
import Register from '../pages/Register';
import Season from '../pages/Season';
import Settings from '../pages/Settings';

function GuardedModule({ permission, children }) {
  return <PermissionGuard permission={permission}>{children}</PermissionGuard>;
}

export default function AppRoutes() {
  return (
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
          <Route
            path="predictions"
            element={(
              <GuardedModule permission={PERMISSIONS.PREDICTIONS_VIEW}>
                <DashboardPredictions />
              </GuardedModule>
            )}
          />
          <Route
            path="weather"
            element={(
              <GuardedModule permission={PERMISSIONS.WEATHER_VIEW}>
                <DashboardWeather />
              </GuardedModule>
            )}
          />
          <Route
            path="seasonal"
            element={(
              <GuardedModule permission={PERMISSIONS.SEASONAL_VIEW}>
                <DashboardSeasonal />
              </GuardedModule>
            )}
          />
          {Object.entries(DASHBOARD_PLACEHOLDER_MODULES).map(([key, config]) => (
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
  );
}
