# nest-ai-starter

A NestJS 12 REST service designed to be built **with AI agents**. nest-cli generates the
structure, repo templates apply the conventions, and agents fill only marked gaps from a
written spec. Every change ends with `npm run verify`.

## Quick start

Node 24 (npm ships with it); no database server:

```bash
npm install && cp .env.example .env    # DATABASE_URL=file:./data/app.db
npm run build && npm start             # app on :3000
npm run verify                         # the gate
```

**Setting the project up includes the local `.env`:** if there is no `.env`, create it from
`.env.example` (on Windows PowerShell: `Copy-Item .env.example .env`). `.env` holds this
machine's settings (`PORT`, `DATABASE_URL`) and git ignores it; never put a local setting in
`.env.example`. If port 3000 is taken, set `PORT` in `.env`.

The database is SQLite: the file `data/app.db`, **committed with seeded data** (users,
notes and shares generated with faker; `scripts/seed.mjs`). `npm run db:seed` rebuilds it from
scratch, reproducibly. The app never migrates a file database itself; `npm run db:migrate` does,
and the seeded file is already migrated. Without `DATABASE_URL` the app in development uses
`data/app.db` anyway (the default in `env.schema.ts`), and the tests (`NODE_ENV=test`, which
never read `.env`) use an empty in-memory database, migrated on connect, so tests never touch
`data/app.db`. If the port is taken, the app exits 1 and says so: set `PORT` in `.env`.

`package-lock.json` pins every dependency. `npm install` follows it; to
change dependencies on purpose, `npm install <pkg>@<version>` and commit the lockfile.
`package.json` turns off the install-time telemetry of `@scarf/scarf` (`scarfSettings`); keep
it off.

## Guided run: one instruction at a time

This repository is used in a guided workshop. A proctor gives one instruction at a time,
and everyone checks the result together before the next one.

- **Always pause after a step and wait for the instructor to move the room along.** When a
  step is done, report and stop: do not start, suggest or prepare the next step, even when it
  looks obvious or you have time left. The instructor decides when the room moves on; you
  continue only when you are pointed at the next step file or given the next instruction.
- Do what the **current** instruction asks, until its done-condition holds (the checks it
  names), then add your `WORKLOG.md` entry (skill `worklog-handoff`), report the counts and
  **stop**. Wait for the next instruction. The entry is part of finishing, not extra work.
- Do not start the next step or module on your own, even though you can see it here: the
  specs of later steps (`specs/notes.md` before notes, `specs/mcp.md` before the MCP server)
  and the red lab checks of later modules (`npm run lab 02` before module 2) are expected,
  and are not work for you until an instruction names them.
- **`steps/` holds the instructions, one file per step** (`steps/01-set-up.md` …). When the
  learner points you at one, do **that file only**. Do not open, list or act on the other step
  files: a later step is the same as a later instruction.
- "Prove it works" means run the checks and show the counts, not build more features.
- **When a step asks you to leave the app running,** start it in the background (`npm start`,
  after `npm run build`) and give the learner the playground link. It stays running between
  steps: after a later step builds new routes, rebuild and restart it so the playground shows
  them, and say so. Tests never need it stopped (they use their own in-memory database).
- **`npm run playground:check`** sends the playground's requests (they mirror lab 01, case by
  case) to the **running** app and prints ✓/✗. It is the only check that sees the app the
  learner is looking at: verify and the labs boot their own copy, so they stay green when the
  running app was never restarted or the module was never wired in.
- **Reseeding:** stop the app first, then `npm run db:seed`, then start it again. Measured: a
  running app whose `data/app.db` is replaced underneath it fails its next write.
- Unsure what the instruction covers? Ask one question instead of guessing wider.

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
├── database/                   DatabaseModule (DB token: the SQLite file in DATABASE_URL; in memory under test), schema.ts, migrate.ts
├── users/users.table.ts        PROVIDED table (seeded); build the users resource on it
├── notes/notes.table.ts        PROVIDED tables (seeded): notes, and note-shares.table.ts (many users per note)
├── common/
│   ├── errors/domain-error.ts      NotFoundError 404 · ConflictError 409 · RuleViolationError 422
│   ├── filters/                    DomainError → HTTP, one error body shape
│   ├── persistence/repository.ts   Repository<T> port + InMemoryRepository adapter
│   ├── zod/                        createZodDto + ZodValidationPipe (+ OpenAPI from the schema)
│   └── schemas/                    PageQuery (?limit&offset), patchSchema (PATCH without defaults)
├── health/                     GET /api/health (unversioned)
├── playground/                 GET /playground: a page that sends every module 1 request with one click
└── <resource>/                 one folder per resource, generated - see below
templates/resource/             the house templates (step 2)
scripts/                        apply-resource-template.mjs, check-ai-fill.mjs, seed.mjs (rebuilds data/app.db),
                                claude-desktop-config.mjs (prints the Claude Desktop entry for the module 2 server)
data/app.db                     the seeded SQLite database (committed)
specs/<plural>.md               one spec per resource; the input for step 3
steps/NN-*.md                   the workshop instructions, one per file: do only the one you are given
```

## Adding a resource: always three steps

1. `npx nest g resource <plural> --type rest --crud` (nest-cli: wiring)
2. `npm run resource:template -- --name <singular> --plural <plural> [--storage drizzle]`
   (templates: conventions; `drizzle` adds a repository and an SQLite table, or keeps a
   provided one)
3. Fill every `AI-FILL(...)` marker from `specs/<plural>.md`, then run `npm run verify`.

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
   then `npm run db:generate`. Read the generated SQL: a nullable `ADD` is safe on a table
   with rows, a `NOT NULL` one is not (see Conventions). `npm run check:migrations` fails
   before the migration exists and passes after.
4. e2e tests for the validation (unit tests get already-parsed input), then
   `npm run verify`.

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
  `npm run db:generate` and commit all of `drizzle/`. Verify a migration by reading the
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
- **Run scripts with `npm run <name>`** (`npm run verify`, `npm run lab 01`). Flags for a
  script go after `--`: `npm run resource:template -- --name note --plural notes`.

## Never

- Commit `.env`, real credentials, internal hostnames or customer data.
- Edit generated templates per resource. Change `templates/resource/` and re-render instead.
- Use `--force` on the template script after AI-FILL work has started.
- Claim "tests pass" without the `Tests:` lines.
