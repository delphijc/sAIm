import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    allowedHosts: ['localhost', '127.0.0.1', 'galatasary.lan'],
    proxy: {
      '/api': {
        target: 'http://localhost:6000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    sourcemap: true
  }
});
