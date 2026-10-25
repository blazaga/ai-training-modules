/**
 * Every drizzle table, re-exported. drizzle-kit reads this file to generate
 * migrations (drizzle.config.ts), and the DB type is built from it.
 * When you add a table, export it here, then run `pnpm db:generate`.
 */
export * from '../users/users.table.js';
