-- ch04b: devices now belong to users.
-- HAND-EDITED. drizzle-kit 0.31.11 generated, for SQLite:
--   ALTER TABLE `devices` ADD `owner_user_id` text NOT NULL REFERENCES users(id);
-- Two defects, both measured:
--   1. On a table that already has rows it fails: "Cannot add a NOT NULL column with
--      default value NULL". On an empty table it applies, so a fresh test database hides it.
--   2. It DROPS `onDelete: 'restrict'` from devices.table.ts: the column gets SQLite's default
--      (NO ACTION). check:migrations cannot see this, because the snapshot and the TypeScript
--      agree; only the SQL is wrong. So the clause is written out below.
--
-- Existing rows: devices created before ownership existed (ch04a) cannot be attributed to
-- anyone. Assigning them to an arbitrary user would hand that user someone else's working
-- credentials, so they are removed. On a fresh database this deletes nothing. With the table
-- empty, SQLite accepts the NOT NULL column.
DELETE FROM `devices`;--> statement-breakpoint
ALTER TABLE `devices` ADD `owner_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict;
