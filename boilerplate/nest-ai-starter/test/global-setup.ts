import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * e2e global setup: build once, because tests that spawn the BUILT app (from module 4,
 * the MCP stdio server in dist/) must run today's code, as a real client would.
 *
 * Fails if the build did not produce a FRESH entrypoint. A stale dist/ would
 * make such a test exercise yesterday's code and pass anyway.
 */
export default function setup(): void {
  const root = join(import.meta.dirname, '..');
  const started = Date.now();
  execFileSync(join(root, 'node_modules', '.bin', 'nest'), ['build'], {
    cwd: root,
    stdio: 'inherit',
  });
  const entry = join(root, 'dist', 'main.js');
  if (statSync(entry).mtimeMs < started - 1000) {
    throw new Error(
      `global-setup: ${entry} is older than this build (stale dist)`,
    );
  }
}
