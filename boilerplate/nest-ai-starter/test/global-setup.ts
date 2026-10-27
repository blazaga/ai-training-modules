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
  // Run the CLI's JS entry with this node, not node_modules/.bin/<tool>: on Windows that
  // shim is a .cmd file, which execFile cannot start (the sh version is no use there either).
  const nest = join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  execFileSync(process.execPath, [nest, 'build'], {
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
