# Chapter 02 — A users table with drizzle and zod

**You will:** add a database layer, upgrade the templates with a Postgres storage variant,
and build `users` (UserController + UserService + unit tests) through the pipeline.
**Commits:** `git log --grep 'course(ch02)'`. **Spec:** `specs/users.md`.

## The database layer (`src/database/`)

- `DatabaseModule` provides one `DB` token app-wide. **`DATABASE_URL` set → Postgres
  (node-postgres). Unset → an in-memory PGlite**, i.e. real Postgres compiled to WASM,
  migrated on boot. Production refuses to start without the URL. The log names the
  driver, never the URL.
- Tests use PGlite too, so `pnpm verify` needs no Docker, while the schema and migrations
  are the same ones production runs.
- `docker compose up -d db` gives you a local Postgres when you want one (its password is
  for your machine only).

```bash
pnpm db:generate            # drizzle-kit: diff tables vs drizzle/, write a migration
pnpm build && pnpm db:migrate   # apply to DATABASE_URL, then PRINT THE LEDGER
```

Verify a migration by reading the **ledger** (`drizzle.__drizzle_migrations`), never
drizzle's log, which reads the same for nine migrations and for zero.
`src/database/connect.spec.ts` asserts that ledger rows == journal entries. Against real
Postgres in Docker we read 3 rows after the first run and still 3 after the second
(idempotent).

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
  `DrizzleRepository`, a service spec that runs on **PGlite** (real SQL, not mocks), a
  **drift test** (table columns == schema fields), and registers the table in
  `src/database/schema.ts`.

```bash
pnpm exec nest g resource users --type rest --crud
pnpm resource:template --name user --plural users --storage drizzle
#   → at the ch02 commit: 13 files, 12 markers (the templates gain auth and
#     server-field markers in ch03–ch04: 17 with the final templates)
pnpm db:generate            # → drizzle/0000_*.sql: CREATE TABLE users …, UNIQUE(email)
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
  new migration, **all 7 users unit tests still passed**, because PGlite is built from the
  migration SQL, not from the TypeScript table. Hence `check:migrations` in `verify`.
- **A checker that passed while its instrument crashed:** the first `check:migrations`
  ran drizzle-kit with an absolute `--out`. drizzle-kit crashed (ENOENT) **and exited 0**,
  and the script reported "clean", including on the drift mutant. Rewritten to fail
  closed on drizzle-kit's own messages, with controls: clean 0, drift 1, broken input 2.
- **Postgres errors become domain errors:** unique violation (23505) → 409 in the generic
  adapter. Timestamp columns need `Date` objects: given an ISO string, drizzle throws
  `value.toISOString is not a function`, so the adapter converts both ways.

## Verify

Unit `Tests 35 passed`, e2e `Tests 26 passed`, `check-migrations: tables match committed
migrations`.

## Labs

1. Add `phone` (optional, E.164) to users: schema, table, migration. Watch
   `check:migrations` fail before `db:generate` and pass after.
2. Add a `findByEmail` unit test for case differences. Which layer lower-cases?
3. Explain why a fast hash (sha256) is fine for chapter 04's device secrets but wrong for
   passwords.
