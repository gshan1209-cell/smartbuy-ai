import { Navigate, Route, Routes } from 'react-router-dom';

import PermissionGuard from '../components/shared/PermissionGuard';
import ProtectedRoute from '../components/shared/ProtectedRoute';
import { DASHBOARD_PLACEHOLDER_MODULES } from '../config/dashboardModules';
import { PERMISSIONS } from '../config/permissions';
import DashboardLayout from '../layouts/DashboardLayout';
import PublicLayout from '../layouts/PublicLayout';
import lazyWithRetry from '../lib/lazyWithRetry';
import {
  DASHBOARD_ROOT,
  DASHBOARD_ROUTES,
  PUBLIC_ROUTES,
  ROUTE_FALLBACK,
} from './routeManifest';

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
        <Route path={PUBLIC_ROUTES.HOME} element={<Home />} />
        <Route path={PUBLIC_ROUTES.SEARCH} element={<PriceSearch />} />
        <Route path={PUBLIC_ROUTES.PRODUCT_DETAIL} element={<ProductDetail />} />
        <Route path={PUBLIC_ROUTES.BASKET} element={<MyBasket />} />
        <Route path={PUBLIC_ROUTES.NEWS} element={<AgriNews />} />
        <Route path={PUBLIC_ROUTES.SPECIAL_OFFERS} element={<SpecialOffers />} />
        <Route path={PUBLIC_ROUTES.INFORMATION_SHARING} element={<MutualAid allowedTypes={['資訊分享']} />} />
        <Route path={PUBLIC_ROUTES.POINTS} element={<PointsCenter />} />
        <Route path={PUBLIC_ROUTES.MUTUAL_AID} element={<MutualAid />} />
        <Route path={PUBLIC_ROUTES.SETTINGS} element={<Settings />} />
        <Route path={PUBLIC_ROUTES.ALERTS} element={<Alerts />} />
        <Route path={PUBLIC_ROUTES.SEASON} element={<Season />} />
        <Route path={PUBLIC_ROUTES.LOGIN} element={<Login />} />
        <Route path={PUBLIC_ROUTES.REGISTER} element={<Register />} />
        <Route path={PUBLIC_ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
        <Route path={ROUTE_FALLBACK} element={<NotFoundPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path={DASHBOARD_ROOT} element={<DashboardLayout />}>
          <Route index element={<Navigate to={DASHBOARD_ROUTES.OVERVIEW} replace />} />
          <Route
            path={DASHBOARD_ROUTES.OVERVIEW}
            element={(
              <GuardedModule permission={PERMISSIONS.DASHBOARD_VIEW}>
                <DashboardOverview />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.PRICES}
            element={(
              <GuardedModule permission={PERMISSIONS.PRICES_VIEW}>
                <DashboardPrices />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.PREDICTIONS}
            element={(
              <GuardedModule permission={PERMISSIONS.PREDICTIONS_VIEW}>
                <DashboardPredictions />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.RECOMMENDATIONS}
            element={(
              <GuardedModule permission={PERMISSIONS.RECOMMENDATIONS_VIEW}>
                <DashboardRecommendations />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.WEATHER}
            element={(
              <GuardedModule permission={PERMISSIONS.WEATHER_VIEW}>
                <DashboardWeather />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.SEASONAL}
            element={(
              <GuardedModule permission={PERMISSIONS.SEASONAL_VIEW}>
                <DashboardSeasonal />
              </GuardedModule>
            )}
          />
          <Route
            path={DASHBOARD_ROUTES.COUPONS}
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
          <Route path={ROUTE_FALLBACK} element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
