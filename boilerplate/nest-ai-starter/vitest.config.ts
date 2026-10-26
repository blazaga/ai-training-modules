import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Some unit tests build an in-memory database and apply every migration; on a busy
    // machine vitest's 5 s default has failed them.
    testTimeout: 20_000,
  },
});
