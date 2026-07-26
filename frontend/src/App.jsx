import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';

import ScrollToTop from './components/ScrollToTop';
import RouteLoadingFallback from './components/shared/RouteLoadingFallback';
import useDocumentTheme from './hooks/useDocumentTheme';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  useDocumentTheme();

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<RouteLoadingFallback />}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
