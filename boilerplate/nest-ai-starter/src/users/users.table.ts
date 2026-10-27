import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  createdAtColumn,
  idColumn,
  updatedAtColumn,
} from '../database/columns.js';

/**
 * The users table, provided with the base: data/app.db already holds seeded rows in it.
 * TS keys are camelCase; SQL columns are snake_case. When you build the users resource,
 * UserSchema must declare exactly these fields: the generated users.table.spec.ts fails on
 * any drift.
 */
export const users = sqliteTable('users', {
  id: idColumn(),
  /** Stored lower-case: the schema normalises it, so the unique index is case-insensitive. */
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
