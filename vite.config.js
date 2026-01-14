import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        viewer: resolve(__dirname, 'index.html'),
        carga: resolve(__dirname, 'carga.html'),
        admin: resolve(__dirname, 'admin.html'),
        bracket: resolve(__dirname, 'bracket.html'),
      },
    },
  },
});
