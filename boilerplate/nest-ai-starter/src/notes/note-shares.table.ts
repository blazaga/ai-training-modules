import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAtColumn } from '../database/columns.js';
import { users } from '../users/users.table.js';
import { notes } from './notes.table.js';

/**
 * Who a note is shared with: many users per note, many notes per user. Provided with the
 * base, seeded. One row per (note, user); deleting the note or the user removes the row.
 */
export const noteShares = sqliteTable(
  'note_shares',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAtColumn(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.userId] })],
);
