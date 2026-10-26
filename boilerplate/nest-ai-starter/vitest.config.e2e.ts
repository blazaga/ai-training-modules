import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e suites boot the whole app and spawn the stdio server (3-7 s under load):
    // vitest's defaults (5 s per test, 10 s per hook) fail them on a busy machine.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Builds dist/ once: the MCP stdio test spawns the built server.
    globalSetup: ['./test/global-setup.ts'],
  },
});
