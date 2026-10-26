import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Some unit tests start in-memory Postgres and apply every migration (~4.5 s on an idle
    // laptop): vitest's 5 s default fails them on a busy machine.
    testTimeout: 20_000,
  },
});
