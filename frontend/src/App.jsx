import { BrowserRouter } from 'react-router-dom';

import ScrollToTop from './components/ScrollToTop';
import useDocumentTheme from './hooks/useDocumentTheme';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  useDocumentTheme();

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
}
