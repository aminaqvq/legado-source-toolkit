import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'web',
  base: '/',
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // Proxy API calls to Fastify backend — use explicit paths so Vite modules
      // under web/lib/ (previously web/api/) are never intercepted.
      '/api/health':   { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/inspect':  { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/validate': { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/process':  { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/upload':   { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/download': { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/jobs':     { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/results':  { target: 'http://127.0.0.1:5178', changeOrigin: true },
      '/api/uploads':  { target: 'http://127.0.0.1:5178', changeOrigin: true },
    },
  },
});
