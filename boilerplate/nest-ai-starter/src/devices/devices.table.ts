import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  createdAtColumn,
  idColumn,
  timestampColumn,
  updatedAtColumn,
} from '../database/columns.js';
import { users } from '../users/users.table.js';

/**
 * The devices table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of DeviceSchema: devices.table.spec.ts
 * fails on any drift. After changing it: `pnpm db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const devices = sqliteTable('devices', {
  id: idColumn(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['draft', 'active', 'archived'] })
    .notNull()
    .default('draft'),
  accessKeyId: text('access_key_id').unique(),
  secretHash: text('secret_hash'),
  secretLast4: text('secret_last4'),
  secretRotatedAt: timestampColumn('secret_rotated_at'),
  lastUsedAt: timestampColumn('last_used_at'),
  archivedAt: timestampColumn('archived_at'),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
