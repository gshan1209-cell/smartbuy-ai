import { Navigate, Route, Routes } from 'react-router-dom';

import PermissionGuard from '../components/shared/PermissionGuard';
import ProtectedRoute from '../components/shared/ProtectedRoute';
import { DASHBOARD_PLACEHOLDER_MODULES } from '../config/dashboardModules';
import { PERMISSIONS } from '../config/permissions';
import DashboardLayout from '../layouts/DashboardLayout';
import PublicLayout from '../layouts/PublicLayout';
import lazyWithRetry from '../lib/lazyWithRetry';

const AgriNews = lazyWithRetry(() => import('../pages/AgriNews'), 'agri-news');
const Alerts = lazyWithRetry(() => import('../pages/Alerts'), 'alerts');
const CouponManagement = lazyWithRetry(
  () => import('../pages/dashboard/CouponManagement'),
  'dashboard-coupons',
);
const DashboardOverview = lazyWithRetry(
  () => import('../pages/dashboard/DashboardOverview'),
  'dashboard-overview',
);
const DashboardPredictions = lazyWithRetry(
  () => import('../pages/dashboard/DashboardPredictions'),
  'dashboard-predictions',
);
const DashboardPrices = lazyWithRetry(
  () => import('../pages/dashboard/DashboardPrices'),
  'dashboard-prices',
);
const DashboardRecommendations = lazyWithRetry(
  () => import('../pages/dashboard/DashboardRecommendations'),
  'dashboard-recommendations',
);
const DashboardSeasonal = lazyWithRetry(
  () => import('../pages/dashboard/DashboardSeasonal'),
  'dashboard-seasonal',
);
const DashboardWeather = lazyWithRetry(
  () => import('../pages/dashboard/DashboardWeather'),
  'dashboard-weather',
);
const ForbiddenPage = lazyWithRetry(() => import('../pages/ForbiddenPage'), 'forbidden');
const Home = lazyWithRetry(() => import('../pages/Home'), 'home');
const Login = lazyWithRetry(() => import('../pages/Login'), 'login');
const MutualAid = lazyWithRetry(() => import('../pages/MutualAid'), 'mutual-aid');
const MyBasket = lazyWithRetry(() => import('../pages/MyBasket'), 'basket');
const NotFoundPage = lazyWithRetry(() => import('../pages/NotFoundPage'), 'not-found');
const Placeholder = lazyWithRetry(() => import('../pages/Placeholder'), 'dashboard-placeholder');
const PointsCenter = lazyWithRetry(() => import('../pages/PointsCenter'), 'points');
const PriceSearch = lazyWithRetry(() => import('../pages/PriceSearch'), 'price-search');
const ProductDetail = lazyWithRetry(() => import('../pages/ProductDetail'), 'product-detail');
const Register = lazyWithRetry(() => import('../pages/Register'), 'register');
const Season = lazyWithRetry(() => import('../pages/Season'), 'season');
const Settings = lazyWithRetry(() => import('../pages/Settings'), 'settings');
const SpecialOffers = lazyWithRetry(() => import('../pages/SpecialOffers'), 'special-offers');

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
        <Route path="/special-offers" element={<SpecialOffers />} />
        <Route path="/information-sharing" element={<MutualAid allowedTypes={['資訊分享']} />} />
        <Route path="/points" element={<PointsCenter />} />
        <Route path="/mutual-aid" element={<MutualAid />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/season" element={<Season />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
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
            path="recommendations"
            element={(
              <GuardedModule permission={PERMISSIONS.RECOMMENDATIONS_VIEW}>
                <DashboardRecommendations />
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
          <Route
            path="coupons"
            element={(
              <GuardedModule permission={PERMISSIONS.COUPONS_MANAGE}>
                <CouponManagement />
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
