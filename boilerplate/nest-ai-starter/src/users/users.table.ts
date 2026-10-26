import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  createdAtColumn,
  idColumn,
  updatedAtColumn,
} from '../database/columns.js';

/**
 * The users table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of UserSchema: users.table.spec.ts
 * fails on any drift. After changing it: `pnpm db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const users = sqliteTable('users', {
  id: idColumn(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'disabled'] })
    .notNull()
    .default('active'),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
