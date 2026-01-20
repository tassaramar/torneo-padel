import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Exponer en la red local
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, 'index.html'),
        carga: resolve(__dirname, 'carga.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
