-- ch04b: devices now belong to users.
-- HAND-EDITED. drizzle-kit generated `ADD COLUMN owner_user_id uuid NOT NULL`, which
-- fails on any table that already has rows ("contains null values", measured). So:
-- add the column as nullable, deal with existing rows, then enforce NOT NULL.
--
-- Existing rows: devices created before ownership existed (ch04a) cannot be
-- attributed to anyone. Assigning them to an arbitrary user would hand that user
-- someone else's working credentials, so they are removed. On a fresh database
-- this deletes nothing.
ALTER TABLE "devices" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
DELETE FROM "devices" WHERE "owner_user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
