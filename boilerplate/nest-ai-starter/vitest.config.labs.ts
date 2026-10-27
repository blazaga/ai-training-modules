import { defineConfig } from 'vitest/config';

/**
 * The lab checks: `npm run lab` runs all of them, `npm run lab 04` one lab.
 * Kept out of `npm run verify` on purpose: a lab check for a lab you have not
 * done yet is SUPPOSED to fail.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // The app ignores .env under test, so these suites never open data/app.db (src/app.module.ts).
    env: { NODE_ENV: 'test' },
    root: './',
    include: ['test/labs/**/*.lab-spec.ts'],
    // Each check boots the whole app on in-memory SQLite. On a busy laptop that can
    // exceed vitest's defaults (5 s per test, 10 s per hook) and fail a correct lab.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
