import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';

// Single source of truth for the app version: package.json.
// Surfaced as __APP_VERSION__ in source (see src/vite-env.d.ts).
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as {version: string};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/motion/')) return 'vendor-motion';
            if (id.includes('/@supabase/')) return 'vendor-supabase';
            if (id.includes('/xlsx/') || id.includes('/papaparse/')) return 'vendor-import';
            if (id.includes('/lucide-react/')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      exclude: ['tests/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx', 'tests/**'],
      },
    },
  };
});
