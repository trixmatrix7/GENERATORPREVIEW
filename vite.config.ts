import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Mirrors the dev generator's vite.config.ts (tailwind + '@' alias) with two
// preview-specific additions: the react-i18next shim (we run standalone, no
// i18n) and __DEV_HARNESS__ defined false.
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      'react-i18next': fileURLToPath(new URL('./src/shims/react-i18next.tsx', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __DEV_HARNESS__: 'false',
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});
