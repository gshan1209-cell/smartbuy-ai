import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function manualChunks(id) {
  const normalized = id.replaceAll('\\', '/');
  if (!normalized.includes('/node_modules/')) return undefined;

  if (
    normalized.includes('/leaflet/')
    || normalized.includes('/react-leaflet/')
    || normalized.includes('/@react-leaflet/')
  ) {
    return 'vendor-map';
  }
  if (normalized.includes('/chart.js/')) {
    return 'vendor-chart';
  }
  if (normalized.includes('/@supabase/')) {
    return 'vendor-supabase';
  }
  if (normalized.includes('/lucide-react/')) {
    return 'vendor-icons';
  }
  if (
    normalized.includes('/react/')
    || normalized.includes('/react-dom/')
    || normalized.includes('/react-router/')
    || normalized.includes('/react-router-dom/')
    || normalized.includes('/@remix-run/router/')
    || normalized.includes('/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (
    normalized.includes('/@radix-ui/')
    || normalized.includes('/class-variance-authority/')
    || normalized.includes('/clsx/')
    || normalized.includes('/tailwind-merge/')
  ) {
    return 'vendor-ui';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/cwa-api': {
        target: 'https://opendata.cwa.gov.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cwa-api/, ''),
      },
    },
  },
});
