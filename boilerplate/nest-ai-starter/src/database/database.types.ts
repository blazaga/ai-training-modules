import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema.js';

/** Injection token for the drizzle database. Inject this, never a driver. */
export const DB = Symbol('DB');

/**
 * The common type of both drivers this starter uses (node-postgres in
 * production, PGlite in tests and keyless dev), so repositories never know
 * which one they got.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
