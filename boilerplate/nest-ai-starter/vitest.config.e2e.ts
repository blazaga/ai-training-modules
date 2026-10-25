import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Builds dist/ once: the MCP stdio test spawns the built server.
    globalSetup: ['./test/global-setup.ts'],
  },
});
