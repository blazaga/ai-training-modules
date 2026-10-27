import { sqliteTable } from 'drizzle-orm/sqlite-core';
import {
  createdAtColumn,
  idColumn,
  updatedAtColumn,
} from '../database/columns.js';

/**
 * The __names__ table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of __Name__Schema: __names__.table.spec.ts
 * fails on any drift. After changing it: `npm run db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const __namesCamel__ = sqliteTable('__names_sql__', {
  id: idColumn(),
  // AI-FILL(columns): one column per field in __Name__Schema, same TS name,
  // snake_case SQL name, matching nullability/default/unique (e.g.
  // `email: text('email').notNull().unique()`). Enums: text('x', { enum: [...] }).
  // Numbers: integer('x'); booleans: integer('x', { mode: 'boolean' }); timestamps:
  // timestampColumn('x') from ../database/columns.js (ISO strings, see there).
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
