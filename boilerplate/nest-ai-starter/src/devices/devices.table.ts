import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The devices table. TS keys are camelCase; SQL columns are snake_case.
 * Must declare exactly the fields of DeviceSchema: devices.table.spec.ts
 * fails on any drift. After changing it: `pnpm db:generate`, then commit the
 * whole drizzle/ folder.
 */
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['draft', 'active', 'archived'] })
    .notNull()
    .default('draft'),
  accessKeyId: text('access_key_id').unique(),
  secretHash: text('secret_hash'),
  secretLast4: text('secret_last4'),
  secretRotatedAt: timestamp('secret_rotated_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
