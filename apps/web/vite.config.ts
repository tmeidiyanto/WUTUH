import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
    proxy: {
      // Teruskan panggilan /api & foto produk /uploads ke backend NestJS saat dev.
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001', changeOrigin: true },
    },
  },
});
