import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import deployments from './deployments.json';
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === 'production' ? {
    'import.meta.env.VITE_SPACETIME_URI': JSON.stringify(deployments.cloud.server),
    'import.meta.env.VITE_SPACETIME_DATABASE': JSON.stringify(deployments.cloud.database),
  } : undefined,
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
}));
