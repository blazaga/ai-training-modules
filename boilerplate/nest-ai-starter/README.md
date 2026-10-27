# nest-ai-starter

A NestJS 12 REST starter for building services **with AI agents, skills and templated
code**. It is the hands-on companion to the course in the course repository's
`docs/ai-agent-training/`. In two modules your AI agent, following the proctor's
instructions, builds the users and notes resources (module 1) and then an MCP server on the
SQLite database (module 2); the lab checks prove each one.

The idea: split every piece of work by who does it best.

| layer       | tool                                                          | output                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| structure   | `nest g resource`                                             | module, controller and service stubs, `AppModule` wiring                |
| conventions | `templates/resource/` + `scripts/apply-resource-template.mjs` | schemas, DTOs, repository, service, controller, specs, always identical |
| domain      | an AI agent, guided by `.claude/skills/`                      | fields, business rules and their tests, only inside `AI-FILL` markers   |
| proof       | `pnpm verify`                                                 | typecheck, lint, zero markers left, unit + e2e tests                    |

## Run it (Node 24 + pnpm, no database server)

```bash
corepack enable && pnpm install
cp .env.example .env                        # DATABASE_URL=file:./data/app.db
pnpm build && pnpm start                    # app on :3000 (pnpm start:dev to watch)
curl localhost:3000/api/health              # {"status":"ok"}
open http://localhost:3000/api/docs         # OpenAPI, generated from the zod schemas
pnpm verify                                 # the full gate
pnpm lab 01                                 # a module's lab check (red until it is built)
```

See the course's Chapter 00 for details.

## The data

`data/app.db` is committed and already seeded: 25 users, 200 notes (the TODO items, each
owned by a user) and 120 shares (a note shared with other users), generated with faker by
`scripts/seed.mjs`. The tables are provided (`src/users/users.table.ts`,
`src/notes/notes.table.ts`, `src/notes/note-shares.table.ts`); the resources on top of them
are what you build. `pnpm db:seed` rebuilds the file from scratch, and two runs write the
same rows. Tests never touch it: they use an empty in-memory database.

## Call it from Postman

`postman/nest-ai-starter.postman_collection.json` holds the REST calls of module 1. Import
it; `baseUrl` is `http://localhost:3000`. Every request carries tests (the Test Results tab),
and a folder works once your agent has built that resource.

## Add a resource

```bash
pnpm exec nest g resource users --type rest --crud                     # 1. nest-cli
pnpm resource:template --name user --plural users --storage drizzle    # 2. templates (keeps the provided table)
# 3. your agent fills the AI-FILL markers from specs/users.md
pnpm verify                                                            # 4. proof
```

See `CLAUDE.md` for conventions and `.claude/skills/nest-resource-scaffold/SKILL.md` for
the full procedure.

## What is in the box

- Nest 12 (the `nest new` defaults: ESM, TypeScript 6, vitest 4, oxlint), zod 4,
  `@nestjs/config`, `@nestjs/swagger`, supertest. All versions pinned exactly, pnpm 12.
- `/api/v1/...` URI versioning, unversioned `/api/health`, and OpenAPI docs
  (disabled by default when `NODE_ENV=production`).
- Env validated at boot. Bad config stops the process with the variable **name**, never
  its value.
- One error shape: `DomainError` → 404/409/422, and validation → 400.
- A repository port with an in-memory adapter and a drizzle adapter, swappable per module.
- SQLite through libSQL: one file, committed migrations, and `pnpm verify` checks the
  tables against them.

## Differences from a bare `nest new` (Nest 12)

- **Validation adapter instead of `nestjs-zod`:** `src/common/zod/` (~60 lines). No release of
  `nestjs-zod`, including its `next` tag, declares support for Nest 12 (peer
  `@nestjs/common ^10 || ^11`). Swagger is generated from the same zod schemas through
  `z.toJSONSchema`. Swap back once `nestjs-zod` supports Nest 12.
- **`pnpm-workspace.yaml` holds the install policy:** `frozenLockfile: true`, a denied build
  script for Swagger UI's install-time telemetry dependency (`@scarf/scarf`), and pnpm 12's
  release-age exception for `@nestjs/swagger`. pnpm 12 **ignores** `frozen-lockfile` in `.npmrc`
  (measured), so the file is gone.
- **Removed:** the scaffold's `deploy` script and `@nestjs/mau` dev dependency (Nest's hosting
  CLI, which is outside this course), and the hello-world controller.
