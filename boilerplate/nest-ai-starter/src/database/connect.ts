import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';
import type { Db } from './database.types.js';

/** The committed migrations (`npm run db:generate` writes them; `npm run db:migrate` applies them). */
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

export interface Connection {
  db: Db;
  /** `file`: a database file (DATABASE_URL); `memory`: gone when the process ends. */
  driver: 'file' | 'memory';
  close(): Promise<void>;
}

/**
 * SQLite through libSQL. `url` is a libSQL URL such as `file:./data/app.db`; without one the
 * database lives in memory.
 *
 * - A FILE database is migrated by `npm run db:migrate` (`dist/database/migrate.js`) before the
 *   app starts, never by the app itself. Its folder is created if missing: libSQL cannot
 *   open a file in a folder that does not exist (measured: ConnectionFailed).
 * - An IN-MEMORY database is empty on every start, so it is migrated here, from the same
 *   committed SQL. Tests therefore run exactly the migrations production applies.
 *
 * Foreign keys: libSQL enables them by default (`PRAGMA foreign_keys` reads 1, measured), and
 * plain SQLite does not. The pragma is set anyway, so ON DELETE RESTRICT never depends on a
 * driver default.
 */
export async function connectSqlite(url?: string): Promise<Connection> {
  if (url?.startsWith('file:')) {
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
  }
  const client = createClient({ url: url ?? ':memory:' });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle({ client, schema });
  if (!url) await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db,
    driver: url ? 'file' : 'memory',
    close: async () => client.close(),
  };
}

/** A fresh, fully migrated in-memory database: what the unit tests use. */
export const connectInMemory = (): Promise<Connection> => connectSqlite();
