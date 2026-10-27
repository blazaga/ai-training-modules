# nest-ai-starter

A NestJS 12 REST service designed to be built **with AI agents**. nest-cli generates the
structure, repo templates apply the conventions, and agents fill only marked gaps from a
written spec. Every change ends with `pnpm verify`.

## Quick start

Node 24 and pnpm (`corepack enable`); no database server:

```bash
pnpm install && cp .env.example .env         # DATABASE_URL=file:./data/app.db
pnpm build && pnpm start                     # app on :3000
pnpm verify                                  # the gate
```

The database is SQLite: the file `data/app.db`, **committed with seeded data** (users,
notes and shares generated with faker; `scripts/seed.mjs`). `pnpm db:seed` rebuilds it from
scratch, reproducibly. The app never migrates a file database itself; `pnpm db:migrate` does,
and the seeded file is already migrated. Without `DATABASE_URL` the app and the tests use an
empty in-memory database, migrated on connect, so tests never touch `data/app.db`.

`pnpm-workspace.yaml` sets `frozenLockfile: true` (pnpm 12 ignores that key in `.npmrc`). To
change dependencies on purpose, run `pnpm install --no-frozen-lockfile` and commit the
lockfile. The same file denies the install-time telemetry script of `@scarf/scarf`; keep it
denied.

## Skills: load before acting

Skills live in `.claude/skills/`.

| task                             | skill                                                |
| -------------------------------- | ---------------------------------------------------- |
| any code change                  | `karpathy-guidelines`, `nestjs-best-practices`       |
| add an endpoint/resource         | `resource-spec` first, then `nest-resource-scaffold` |
| add a setting or secret          | `env-config`                                         |
| multi-step or multi-session work | `plan-feature`                                       |
| before saying "done"             | `nest-verify`                                        |
| end of every session             | `worklog-handoff`                                    |

`nestjs-best-practices` shows class-validator DTOs in its examples. **This repo uses zod
via the in-repo adapter in `src/common/zod/`** (`createZodDto`, `ZodValidationPipe`), and this
file wins wherever the two disagree. The adapter replaces `nestjs-zod`, which has no Nest 12
release.

## Layout

```
src/
├── main.ts                     bootstrap: listen and log the port only
├── app.module.ts               ConfigModule (validated), global ZodValidationPipe + DomainExceptionFilter
├── bootstrap/configure-app.ts  prefix /api, URI versioning v1, swagger; shared by main.ts AND e2e
├── config/env.schema.ts        the ONLY place env vars are declared and validated
├── database/                   DatabaseModule (DB token: the SQLite file in DATABASE_URL, else in memory), schema.ts, migrate.ts
├── users/users.table.ts        PROVIDED table (seeded); build the users resource on it
├── notes/notes.table.ts        PROVIDED tables (seeded): notes, and note-shares.table.ts (many users per note)
├── common/
│   ├── errors/domain-error.ts      NotFoundError 404 · ConflictError 409 · RuleViolationError 422
│   ├── filters/                    DomainError → HTTP, one error body shape
│   ├── persistence/repository.ts   Repository<T> port + InMemoryRepository adapter
│   ├── zod/                        createZodDto + ZodValidationPipe (+ OpenAPI from the schema)
│   └── schemas/                    PageQuery (?limit&offset), patchSchema (PATCH without defaults)
├── health/                     GET /api/health (unversioned)
└── <resource>/                 one folder per resource, generated - see below
templates/resource/             the house templates (step 2)
scripts/                        apply-resource-template.mjs, check-ai-fill.mjs, seed.mjs (rebuilds data/app.db)
data/app.db                     the seeded SQLite database (committed)
specs/<plural>.md               one spec per resource; the input for step 3
```

## Adding a resource: always three steps

1. `pnpm exec nest g resource <plural> --type rest --crud` (nest-cli: wiring)
2. `pnpm resource:template --name <singular> --plural <plural> [--storage drizzle]`
   (templates: conventions; `drizzle` adds a repository and an SQLite table, or keeps a
   provided one)
3. Fill every `AI-FILL(...)` marker from `specs/<plural>.md`, then run `pnpm verify`.

Full procedure and traps: `.claude/skills/nest-resource-scaffold/SKILL.md`.

**Provided tables:** `users`, `notes` and `note_shares` already exist (migration `0000`, seeded
rows). With `--storage drizzle` the template script **keeps** a provided `<plural>.table.ts`
and generates the rest around it; the generated drift test then holds your schema to the
table. Do not generate a migration for a provided table.

## Adding a field to an existing resource

1. The spec first (`specs/<plural>.md`): the field, its rule, and what `null` means.
2. The zod schema (`<name>.schema.ts`): create, patch and response schemas derive from
   it, so the field is declared once. A unit-test fixture typed as the parsed DTO
   needs the new field too (tsc says where).
3. With SQLite storage: the column in `<plural>.table.ts` (the drift test requires it),
   then `pnpm db:generate`. Read the generated SQL: a nullable `ADD` is safe on a table
   with rows, a `NOT NULL` one is not (see Conventions). `pnpm check:migrations` fails
   before the migration exists and passes after.
4. e2e tests for the validation (unit tests get already-parsed input), then
   `pnpm verify`.

## Conventions

- **Validation:** zod schemas are the single source of truth. DTOs are
  `class X extends createZodDto(Schema)` from `src/common/zod/zod-dto.js`. Never hand-write a
  field in two places.
- **ESM:** the package is `"type": "module"`. Every relative import ends in `.js`
  (`'./notes.service.js'`), including in templates. TypeScript resolves it to the `.ts` file.
- **Placement of rules:** a rule that needs only the payload goes in the schema (400). A
  rule that needs stored state goes in the service and throws a `DomainError` (422/409).
- **Errors:** services throw `DomainError` subclasses. Never `return { success: false }`
  with HTTP 200, and never try/catch in controllers.
- **Controllers:** parse, delegate, return. Use `ParseUUIDPipe` on ids. A successful
  DELETE returns 204.
- **Data access:** inject the repository **token** (`<PLURAL>_REPOSITORY`), never a class.
  Storage is swapped in the module only. SQLite tables are drizzle (`*.table.ts`),
  registered in `src/database/schema.ts`; ids and timestamps use the helpers in
  `src/database/columns.ts` (TEXT: a UUID, an ISO string). After any table change,
  `pnpm db:generate` and commit all of `drizzle/`. Verify a migration by reading the
  `__drizzle_migrations` table, never drizzle's log.
- **Private fields** (a password or secret hash, if a resource ever has one) live in the
  schema's `PRIVATE` set. Responses go through `<Name>ResponseSchema`, so they never leave
  the API.
- **Generated migrations are not automatically safe.** drizzle-kit emits `ADD … NOT NULL`
  with no warning, and SQLite refuses it on any table that has rows (an empty test database
  hides that). It also drops `ON DELETE` from a foreign key added with `ADD`. Read every
  generated SQL file; hand-edit it (decide what happens to existing rows, write the
  `ON DELETE` clause out), and say why in a SQL comment.
- **Config:** read via `ConfigService<Env, true>`, never `process.env`. **Never log config
  values.**
- **Imports:** relative within `src/`. If you add path aliases, use them everywhere.
- **Files:** kebab-case with a type suffix (`.service.ts`, `.schema.ts`, `.spec.ts`).

## Verification discipline

- **Read the output, not the exit code.** Each check prints a count. Report the counts.
- **Prove checks can fail:** plant a type error once, and delete each business rule once
  and watch a test go red.
- **Layer matters:** validation, defaults and status-code bugs are only visible to e2e
  tests. Unit tests get already-parsed input.
- **`pnpm` may not be on PATH:** use `corepack pnpm`. The `verify` script calls the tool
  binaries directly, so it works either way.

## Never

- Commit `.env`, real credentials, internal hostnames or customer data.
- Edit generated templates per resource. Change `templates/resource/` and re-render instead.
- Use `--force` on the template script after AI-FILL work has started.
- Claim "tests pass" without the `Tests:` lines.
