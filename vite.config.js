import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/portfolio': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/company-details': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/stock-chart': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/live-quote': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/recommendation': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/sentiment': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/refresh-portfolio': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
