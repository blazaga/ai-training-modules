import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import * as schema from './schema.js';
import type { Db } from './database.types.js';

/** drizzle/ at the project root, from src/database (tests) or dist/database (build). */
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

export interface Connection {
  db: Db;
  driver: 'postgres' | 'pglite';
  close(): Promise<void>;
}

/** Real Postgres. Migrations are applied separately, with `pnpm db:migrate`. */
export function connectPostgres(url: string): Connection {
  const pool = new Pool({ connectionString: url });
  return {
    db: drizzlePg({ client: pool, schema }) as unknown as Db,
    driver: 'postgres',
    close: () => pool.end(),
  };
}

/**
 * In-process Postgres (PGlite), in memory, migrated on creation. Used by tests
 * and by `start:dev` when no DATABASE_URL is set. Data is lost when it closes.
 */
export async function connectPglite(): Promise<Connection> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: db as unknown as Db,
    driver: 'pglite',
    close: () => client.close(),
  };
}
