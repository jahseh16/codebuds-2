import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// TEMPORAL (pruebas de UI): igual que vite.config.ts pero con proxy hacia
// una instancia propia del backend en el puerto 3102.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3102',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3102',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
