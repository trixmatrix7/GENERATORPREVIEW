import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Mirrors the dev generator's vite.config.ts (tailwind + '@' alias) with two
// preview-specific additions: the react-i18next shim (we run standalone, no
// i18n) and __DEV_HARNESS__ defined false.
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // PREVIEW STABILITY (Noski): partial HMR into a running PixiJS app corrupts
    // the singleton (duplicate tickers/renderers) → white/dead screen until a
    // manual reload. Any source change now triggers a CLEAN FULL RELOAD of the
    // page instead — the slot always comes back up by itself.
    {
      name: 'full-reload-on-src-change',
      handleHotUpdate({ file, server }) {
        const f = file.replace(/\\/g, '/');
        if (f.includes('/src/')) {
          server.ws.send({ type: 'full-reload' });
          return [];
        }
      },
    },
  ],
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
    // No error overlay covering the slot — errors go to the console; the
    // ErrorBoundary in main.tsx auto-recovers the page instead.
    hmr: { overlay: false },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});
