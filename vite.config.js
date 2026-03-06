import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0', // Exponer en la red local
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, 'index.html'),
        general: resolve(__dirname, 'general.html'),
        carga: resolve(__dirname, 'carga.html'),
        admin: resolve(__dirname, 'admin.html'),
        analytics: resolve(__dirname, 'analytics.html'),
        fixture: resolve(__dirname, 'fixture.html'),
        presente: resolve(__dirname, 'presente.html'),
      },
    },
  },
});
