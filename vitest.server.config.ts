import { defineConfig } from 'vitest/config';

/**
 * Server-side tests (`tests/server/**`).
 *
 * Separate config because the API is plain Node ESM — no jsdom, no DOM setup
 * file, no CSS. The default config (vite.config.ts `test`) stays jsdom for
 * `src/test/**`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/server/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
