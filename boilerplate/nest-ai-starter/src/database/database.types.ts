import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from './schema.js';

/** Injection token for the drizzle database (`@Inject(DB) private readonly db: Db`). */
export const DB = Symbol('DB');

/** drizzle over libSQL (SQLite), for a database file and for the in-memory test database alike. */
export type Db = LibSQLDatabase<typeof schema>;
