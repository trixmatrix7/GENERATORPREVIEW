import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine/index.ts', import.meta.url)),
      '@registries': fileURLToPath(new URL('./src/registries/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2021',
    outDir: 'dist',
    sourcemap: true,
  },
});
