import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/theme.css';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/public-layout.css';
import './styles/public-header-responsive.css';
import './styles/dashboard-layout.css';
import './styles/test-mode.css';
import './styles/app-resilience.css';
import './styles/responsive-overrides.css';
import App from './App';
import AppErrorBoundary from './components/shared/AppErrorBoundary';
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
