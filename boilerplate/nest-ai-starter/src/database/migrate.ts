// `pnpm db:migrate`: apply drizzle/ migrations to DATABASE_URL, then print the
// ledger. Verify a migration by reading drizzle.__drizzle_migrations, never by
// trusting this script's exit code. drizzle's own output is the same for nine
// migrations and for zero.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { validateEnv } from '../config/env.schema.js';
import { connectPostgres, MIGRATIONS_FOLDER } from './connect.js';

const env = validateEnv(process.env);
if (!env.DATABASE_URL) {
  console.error('db:migrate: DATABASE_URL is not set (nothing to migrate).');
  process.exit(1);
}

const connection = connectPostgres(env.DATABASE_URL);
const { db } = connection;
try {
  await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  // node-postgres returns { rows }; the driver-agnostic Db type leaves it unknown.
  const ledger = (await db.execute(
    sql`select id, hash, created_at from drizzle.__drizzle_migrations order by id`,
  )) as unknown as { rows: Record<string, unknown>[] };
  console.log(`db:migrate: ledger rows: ${ledger.rows.length}`);
  for (const row of ledger.rows) console.log(`  ${JSON.stringify(row)}`);
} finally {
  await connection.close();
}
