#!/usr/bin/env node
// Fails when the drizzle tables in src/ and the committed migrations in drizzle/
// disagree, i.e. someone changed a *.table.ts and forgot `pnpm db:generate`.
//
// Why this needs its own check: tests run on an in-memory database built from the
// MIGRATION SQL, not from the TypeScript tables. Measured: with `.unique()` removed from
// users.table.ts and no new migration, all 7 users unit tests still passed.
//
// Method: copy drizzle/ to a scratch dir inside the project, run drizzle-kit
// generate INTO the copy, and read what it SAYS. FAILS CLOSED. Measured on
// drizzle-kit 0.31.11: given an absolute --out it crashes with ENOENT and still
// exits 0, so the exit code proves nothing. Pass only on its own "No schema
// changes" message, fail on "Your SQL migration file", and treat anything else
// (a crash included) as an error.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = join(root, 'node_modules', '.bin', 'drizzle-kit');
const SCRATCH = '.drizzle-check'; // relative: drizzle-kit mangles absolute --out paths
const CLEAN = 'No schema changes, nothing to migrate';
const DRIFT = 'Your SQL migration file';

if (!existsSync(kit)) {
  console.error('check-migrations: drizzle-kit missing - run pnpm install');
  process.exit(2);
}

const scratch = join(root, SCRATCH);
rmSync(scratch, { recursive: true, force: true });
try {
  if (existsSync(join(root, 'drizzle'))) {
    cpSync(join(root, 'drizzle'), scratch, { recursive: true });
  }
  const run = spawnSync(
    kit,
    [
      'generate',
      '--dialect',
      'sqlite',
      '--schema',
      './src/database/schema.ts',
      '--out',
      `./${SCRATCH}`,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  if (output.includes(DRIFT)) {
    console.error(
      'check-migrations: DRIFT - tables changed without a migration.',
    );
    console.error(
      '  run `pnpm db:generate` and commit the whole drizzle/ folder.',
    );
    process.exit(1);
  }
  if (!output.includes(CLEAN)) {
    console.error(
      `check-migrations: could not verify (drizzle-kit exit ${run.status}); output tail:`,
    );
    console.error(output.trim().split('\n').slice(-5).join('\n'));
    process.exit(2);
  }
  console.log(
    'check-migrations: tables match committed migrations (drizzle-kit: no schema changes)',
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
