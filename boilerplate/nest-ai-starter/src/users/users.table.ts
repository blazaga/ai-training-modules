import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The users table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of UserSchema: users.table.spec.ts
 * fails on any drift. After changing it: `pnpm db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'disabled'] })
    .notNull()
    .default('active'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
