// `npm run db:migrate`: apply drizzle/ migrations to DATABASE_URL, then print the
// ledger. Verify a migration by reading the `__drizzle_migrations` table, never by
// trusting this script's exit code. drizzle's own output is the same for nine
// migrations and for zero.
import { migrate } from 'drizzle-orm/libsql/migrator';
import { sql } from 'drizzle-orm';
import { validateEnv } from '../config/env.schema.js';
import { connectSqlite, MIGRATIONS_FOLDER } from './connect.js';

const env = validateEnv(process.env);
if (!env.DATABASE_URL) {
  console.error('db:migrate: DATABASE_URL is not set (nothing to migrate).');
  process.exit(1);
}

const connection = await connectSqlite(env.DATABASE_URL);
const { db } = connection;
try {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  // drizzle declares this table's id as SERIAL, which SQLite does not auto-fill (it reads
  // null), so the ledger is ordered by when each migration was applied.
  const ledger = await db.all<{ hash: string; created_at: number }>(
    sql`select hash, created_at from __drizzle_migrations order by created_at`,
  );
  console.log(`db:migrate: ledger rows: ${ledger.length}`);
  for (const row of ledger) console.log(`  ${JSON.stringify(row)}`);
} finally {
  await connection.close();
}
