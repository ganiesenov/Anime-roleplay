import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served by the FastAPI backend under /next (same origin as the legacy app, so
// the new UI can read the same AriaBD IndexedDB and hit /api + /v1). During `npm
// run dev` the proxy forwards API calls to the running backend on :8000.
export default defineConfig({
  base: '/next/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/v1': 'http://127.0.0.1:8000',
    },
  },
});
