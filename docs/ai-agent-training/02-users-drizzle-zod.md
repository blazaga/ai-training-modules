# Chapter 02 — A users table with drizzle and zod

**You will:** add a database layer, upgrade the templates with an SQLite storage variant,
and build `users` (UserController + UserService + unit tests) through the pipeline.
**Commits:** `git log --grep 'course(ch02)'`. **Spec:** `specs/users.md`.

## The database layer (`src/database/`)

- The database is **SQLite**, through libSQL (`@libsql/client`, `drizzle-orm/libsql`): no
  database server, one file. `DatabaseModule` provides one `DB` token app-wide.
  **`DATABASE_URL` set (a `file:` URL) → that file. Unset → an in-memory database**,
  migrated on boot. Production refuses to start without the URL. The log names the
  driver, never the URL.
- Tests use the in-memory database too, so `pnpm verify` never touches `data/app.db`, while
  the schema and migrations are the same ones the app's file gets.
- The app never migrates its file database itself: `pnpm db:migrate` does, before
  `pnpm start` (chapter 00). A failed migration therefore stops before the app runs on a
  half-migrated file.
- SQLite has no uuid or timestamp types. Ids are TEXT holding a UUID, timestamps are TEXT
  holding `toISOString()`: helpers in `src/database/columns.ts`. In that one format the
  strings sort in time order, which is why every timestamp must use it.

```bash
pnpm db:generate            # drizzle-kit: diff tables vs drizzle/, write a migration
pnpm build && pnpm db:migrate   # apply to DATABASE_URL, then PRINT THE LEDGER
```

Verify a migration by reading the **ledger** (the `__drizzle_migrations` table), never
drizzle's log, which reads the same for nine migrations and for zero.
`src/database/connect.spec.ts` asserts that ledger rows == journal entries. On the base we
read 1 row after the first run and still 1 after the second (idempotent); after your agent's
module 2 migration it is 2, and 3 once devices arrive in module 3.

## Upgrading the templates (once, for every future resource)

Users have a field no earlier resource had: a **password hash**, stored but never
returned and never accepted from a client. So the templates gained:

- `PRIVATE` fields + `<Name>ResponseSchema`: every response is parsed through it, so a
  private field cannot leave, and a generic e2e test checks that no response carries a
  non-public key.
- `create-mapping`: write-only inputs (`password`) become private fields
  (`passwordHash`). It **fails to compile until you write it**, because a `password` is
  not a `passwordHash`.
- `--storage drizzle`: adds `<plural>.table.ts`, a repository on the generic
  `DrizzleRepository`, a service spec that runs on **in-memory SQLite** (real SQL, not
  mocks), a
  **drift test** (table columns == schema fields), and registers the table in
  `src/database/schema.ts`.

```bash
pnpm exec nest g resource users --type rest --crud
pnpm resource:template --name user --plural users --storage drizzle
#   → at the ch02 commit: 13 files, 12 markers (the templates gain auth and
#     server-field markers in ch03–ch04: 17 with the final templates)
pnpm db:generate            # → drizzle/0000_*.sql: CREATE TABLE users …, UNIQUE INDEX on email
```

## The users rules (from the spec) and where each lives

| rule                                               | where                                    | proven by                                                             |
| -------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| R1 email unique, case-insensitive                  | schema lower-cases; table `unique` → 409 | e2e: `ADA@…` after `ada@…` → 409 (removing the lower-casing fails it) |
| R2 password hashed with scrypt, never stored plain | service `create-mapping`                 | unit: hash verifies, plain text absent (storing plain fails it)       |
| R3 `passwordHash` never in a response              | `PRIVATE`                                | making it non-private fails **tsc and 7 e2e tests**                   |

Passwords use Node's built-in **scrypt** (salted, self-describing format, timing-safe
compare): no native module, so nothing for pnpm's build-script policy to block.

## What we measured building it

- **Drift that tests cannot see:** with `.unique()` deleted from `users.table.ts` and no
  new migration, **all 7 users unit tests still passed**, because the in-memory database is
  built from the migration SQL, not from the TypeScript table. Hence `check:migrations` in
  `verify`, which reports `DRIFT` for exactly that mutant.
- **A checker that passed while its instrument crashed:** the first `check:migrations`
  ran drizzle-kit with an absolute `--out`. drizzle-kit crashed (ENOENT) **and exited 0**,
  and the script reported "clean", including on the drift mutant. Rewritten to fail
  closed on drizzle-kit's own messages, with controls: clean 0, drift 1, broken input 2.
- **Database errors become domain errors:** a unique violation is
  `SQLITE_CONSTRAINT_UNIQUE` on the driver error (drizzle wraps it, so the adapter walks the
  `cause` chain) → 409 in the generic adapter. Timestamps are already ISO strings in and out,
  so rows need no conversion.

## Verify

Unit `Tests 35 passed`, e2e `Tests 26 passed`, `check-migrations: tables match committed
migrations`.

## Labs

Lab 1 is module 2, built by your agent from the proctor's instruction and checked with
`pnpm lab 02`. The contract (E.164, `null` when absent, the migration) is in
`boilerplate/nest-ai-starter/test/labs/README.md`.

1. **Your agent adds `phone`** (optional, E.164) to users: schema, table, migration. You
   check: `check:migrations` failed before `db:generate` and passes after (ask the agent to
   show you both), the ledger went from 1 row to 2, and the generated SQL is a nullable
   `ADD` that is safe on a table that already has rows. Ask the agent why it is safe, and
   check its answer against the SQL.
2. Add a `findByEmail` unit test for case differences. Which layer lower-cases?
3. Explain why a fast hash (sha256) is fine for chapter 04's device secrets but wrong for
   passwords.
