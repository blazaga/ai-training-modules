import { defineConfig } from 'vitest/config';

/**
 * The lab checks: `pnpm lab` runs all of them, `pnpm lab 04` one lab.
 * Kept out of `pnpm verify` on purpose: a lab check for a lab you have not
 * done yet is SUPPOSED to fail.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/labs/**/*.lab-spec.ts'],
    // Each check boots the whole app on in-memory Postgres. On a busy laptop that can
    // exceed vitest's defaults (5 s per test, 10 s per hook) and fail a correct lab.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
