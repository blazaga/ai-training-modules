# Chapter 04 — Devices: credentials first, then merged with users

**You will:** build a device service whose credentials (an access key id + a secret) will
authenticate the MCP server in chapter 09. Build it standalone first, then merge it with
users. **Commits:** `course(ch04a)`, `course(ch04b)`. **Spec:** `specs/devices.md`.

## Modelled on dna_forms, corrected

In the dna_forms portal a device is a non-human account owned by the user who registered
it; it sends an app id + secret as request headers. A read-only survey of that code also
found things **not** to copy, so the spec corrects them:

| measured there                                                         | here                                                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| secrets generated in the **browser**                                   | generated on the **server** only                                 |
| plaintext secret cached in Redis and readable back through an endpoint | shown **once**, stored only as `sha256`                          |
| rotation left a cached secret valid for minutes                        | rotation replaces the hash; the old secret fails **immediately** |
| detailed failure reasons returned to the client                        | one identical 401                                                |

## Step 1 (ch04a): the device resource and its credentials

One more template upgrade first: **`server-fields`**, fields that are returned but never
accepted (`status`, `accessKeyId`, timestamps). Only actions change them: a client
sending `status: 'active'` gets a draft. `remove-rules` joins create/update.

```bash
pnpm exec nest g resource devices --type rest --crud
pnpm resource:template --name device --plural devices --storage drizzle   # 17 markers
```

- `accessKeyId = 'AKID' + base32(10 random bytes)`: an identifier, safe to show.
- `secret = 'dsk_' + base64url(32 random bytes)`: 256 bits. The prefix lets secret
  scanners find a leak.
- `sha256` at rest is right for a 256-bit random secret (nothing to brute-force) and wrong
  for human passwords (chapter 02 uses scrypt). Comparison is timing-safe.
- Lifecycle: `POST /:id/credentials` (issue/rotate; **the only response that ever
  contains the secret**), `/activate` (needs credentials), `/archive` (soft delete).
  `DELETE` only removes drafts.
- `verifyAccessKey()` (used in chapter 09) authenticates only **active** devices and
  records `lastUsedAt`.

Mutations: rotation keeping the old hash → 1 fails; non-active devices authenticating →
2 fail; a comparison that always matches → 4 fail.

## Step 2 (ch04b): merge with users

- `ownerUserId` (server-owned, FK → users, `ON DELETE RESTRICT`). Every service method
  takes the owner, and `findOne` enforces it, so every other method inherits the check.
- **Another user's device is 404, not 403**, so ids cannot be probed.
- Deleting a user who still owns a device → **409**.

This step deliberately changes generated signatures. Templates get you a consistent
start; evolving a resource afterwards is normal, as long as the change is explicit and
tested.

### Three measurements that changed the code

1. **drizzle-kit's migration fails on a populated table.** It generated
   ``ALTER TABLE `devices` ADD `owner_user_id` text NOT NULL REFERENCES users(id)`` with no
   warning. On an empty table it applies, so a fresh test database hides the problem;
   applied to a table with a ch04a device it failed with `Cannot add a NOT NULL column with
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

Unit `Tests 66 passed`, e2e `Tests 47 passed`. Removing the owner check fails 1 unit and
1 e2e test.

## Labs

Lab 1 is checked: `pnpm lab 04`. The contract (the optional body, 400 for a past
date, `null` when not given, the 401 after expiry) is in
`boilerplate/nest-ai-starter/test/labs/README.md`.

1. Add `expiresAt` to credentials, so an expired secret fails `verifyAccessKey`. Where does
   the rule live?
2. Write the migration for a NOT NULL column with a sensible default instead of a delete.
   Probe it on a populated table.
3. Why 404 rather than 403 for someone else's device? Write the e2e test that would
   catch a 403.
