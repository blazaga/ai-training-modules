import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The __names__ table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of __Name__Schema: __names__.table.spec.ts
 * fails on any drift. After changing it: `pnpm db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const __namesCamel__ = pgTable('__names_sql__', {
  id: uuid('id').primaryKey().defaultRandom(),
  // AI-FILL(columns): one column per field in __Name__Schema, same TS name,
  // snake_case SQL name, matching nullability/default/unique (e.g.
  // `email: text('email').notNull().unique()`). Enums: text('x', { enum: [...] }).
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
