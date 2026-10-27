import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  createdAtColumn,
  idColumn,
  timestampColumn,
  updatedAtColumn,
} from '../database/columns.js';
import { users } from '../users/users.table.js';

/**
 * The notes table (the TODO items of this app), provided with the base: data/app.db already
 * holds seeded rows. A user owns many notes (`owner_id`); sharing a note with other users is
 * the note_shares table. When you build the notes resource, NoteSchema must declare exactly
 * these fields: the generated notes.table.spec.ts fails on any drift.
 */
export const notes = sqliteTable('notes', {
  id: idColumn(),
  /** The owner. RESTRICT: a user who still owns notes cannot be deleted. */
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  status: text('status', { enum: ['open', 'done'] })
    .notNull()
    .default('open'),
  /** Optional due date: an ISO-8601 UTC timestamp, like every timestamp here. */
  dueAt: timestampColumn('due_at'),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
