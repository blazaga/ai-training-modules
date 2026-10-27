# Chapter 04 — Devices: provisioned with a key and a secret

**Your agent will:** build devices (the third instruction of module 3), the non-human clients
(an AI agent, say) that call the MCP server in chapter 09. A user provisions a device with
one call and gets back a key and a secret; the device then sends them as `X-Device-Key` and
`X-Device-Secret`. **Spec:** `specs/devices.md`.

## Modelled on a production portal, corrected

In a production portal we surveyed, a device is a non-human account owned by the user who
registered it; it sends an app id + secret as request headers. A read-only survey of that code also
found things **not** to copy, so the spec corrects them:

| measured there                                                         | here                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| secrets generated in the **browser**                                   | generated on the **server** only                                 |
| plaintext secret cached in Redis and readable back through an endpoint | shown **once**, stored only as `sha256`                          |
| rotation left a cached secret valid for minutes                        | rotation replaces the hash; the old secret fails **immediately** |
| detailed failure reasons returned to the client                        | one identical 401                                                |

## Step 1: provisioning

One more template upgrade first: **`server-fields`**, fields that are returned but never
accepted (`status`, `deviceKey`, timestamps). A client sending `status: 'archived'` to
provision still gets an active device.

```bash
pnpm exec nest g resource devices --type rest --crud
pnpm resource:template --name device --plural devices --storage drizzle
```

```bash
curl -s -X POST localhost:3000/api/v1/devices/provision \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"my agent"}'
# {"id":"…","status":"active","deviceKey":"DK…","secret":"dsk_…","secretLast4":"…",…}
```

- `POST /devices/provision` creates an **active** device for the caller and returns it with
  `deviceKey` and `secret`. **That response, and rotate's, are the only ones that ever
  contain the secret.**
- `deviceKey = 'DK' + base32(10 random bytes)`: an identifier, safe to show.
- `secret = 'dsk_' + base64url(32 random bytes)`: 256 bits. The prefix lets secret scanners
  find a leak.
- `sha256` at rest is right for a 256-bit random secret (nothing to brute-force) and wrong
  for human passwords (chapter 02 uses scrypt). Comparison is timing-safe.
- `POST /devices/:id/rotate` gives a new secret for the same key. `DELETE` archives the
  device (a soft delete): the row stays, and its key stops working at once.
- `verifyDeviceKey()` (used in chapter 09) authenticates only **active** devices and
  records `lastUsedAt`.

Mutations (each must turn something red, measured): rotation keeping the old hash → 1 unit
and 1 e2e test fail; archived devices authenticating → 1 + 1; a comparison that always
matches → 4 unit + 1 e2e.

## Step 2: devices belong to users

- `ownerUserId` (server-owned, FK → users, `ON DELETE RESTRICT`). Every service method
  takes the owner, and `findOne` enforces it, so every other method inherits the check.
- **Another user's device is 404, not 403**, so ids cannot be probed.
- Deleting a user who still owns a device → **409**.

This step deliberately changes generated signatures. Templates get you a consistent
start; evolving a resource afterwards is normal, as long as the change is explicit and
tested.

### Three measurements that changed the code

The first two were measured when devices were built in two steps, ownership added to an
existing table. In the workshop your agent creates the table with its owner in one
migration (`CREATE TABLE … FOREIGN KEY … ON DELETE restrict`), so neither arises there.
Keep them for the next column you add to a table that already has rows.

1. **drizzle-kit's migration fails on a populated table.** It generated
   ``ALTER TABLE `devices` ADD `owner_user_id` text NOT NULL REFERENCES users(id)`` with no
   warning. On an empty table it applies, so a fresh test database hides the problem;
   applied to a table that already had a device it failed with `Cannot add a NOT NULL column with
default value NULL`. The migration was hand-edited to remove the unattributable
   pre-ownership devices first (assigning them would hand someone else's credentials to an
   arbitrary user), after which SQLite accepts the NOT NULL column. The reasoning is in a
   SQL comment, and it was probed on a populated and a fresh database.
2. **The generated SQL dropped the delete rule.** `devices.table.ts` says
   `onDelete: 'restrict'`; the generated `ADD … REFERENCES users(id)` has no `ON DELETE`, so
   the column got SQLite's default (NO ACTION). `check:migrations` cannot see it, because the
   snapshot and the TypeScript agree and only the SQL is wrong. The clause is written out in
   the hand-edited migration; afterwards a blocked delete reports the RESTRICT code below,
   which is how we know it took effect.
3. **RESTRICT and NO ACTION report different codes:** `SQLITE_CONSTRAINT_TRIGGER` vs
   `SQLITE_CONSTRAINT_FOREIGNKEY` (both say "FOREIGN KEY constraint failed"). With only the
   second mapped to 409, the e2e test "a user who still owns a device cannot be deleted
   (409)" fails (measured), so the adapter maps both.

## Verify

Removing the owner check fails 1 unit and 1 e2e test (measured). At the module 3
checkpoint (`checkpoints/`), `pnpm verify` reports 66 unit and 72 e2e tests, and
`pnpm lab 03 04` is green.

## Labs

`pnpm lab 04` checks what your agent built in module 3: provision returns an active device
with a key and a one-time secret, rotate keeps the key and changes the secret, archive keeps
the row, and another user's device is 404. It is red on the base.

Lab 12 is a stretch for after module 6 (it needs `/mcp`), checked with `pnpm lab 12`. The
contract (an optional `expiresAt` on provision and rotate, 400 for a past date, `null` when
not given, the 401 on `/mcp` after expiry) is in
`boilerplate/nest-ai-starter/test/labs/README.md`.

1. Have your agent add `expiresAt`, so an expired secret fails `verifyDeviceKey`. Where did
   it put the rule, and does `/mcp` answer an expired secret with the same 401 as every other
   failure?
2. Write the migration for a NOT NULL column with a sensible default instead of a delete.
   Probe it on a populated table.
3. Why 404 rather than 403 for someone else's device? Write the e2e test that would
   catch a 403.
