import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT || '3009'),
      host: true,
      proxy: {
        '/api': {
          target: `http://localhost:${env.VITE_API_PORT || '8002'}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${env.VITE_API_PORT || '8002'}`,
          changeOrigin: true,
        },
      },
    },
  };
});
