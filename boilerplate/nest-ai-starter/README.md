# nest-ai-starter

A NestJS 12 REST starter for building services **with AI agents, skills and templated
code**. It is the hands-on companion to the course in the course repository's
`docs/ai-agent-training/`: in each
module your AI agent, following the proctor's instructions, adds the next layer (a
resource, a column, authentication, devices, an MCP server), and the lab checks prove it.

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
pnpm build && pnpm db:migrate               # create the SQLite file, apply drizzle/, print the ledger
pnpm start                                  # app on :3000 (pnpm start:dev to watch)
curl localhost:3000/api/health              # {"status":"ok"}
open http://localhost:3000/api/docs         # OpenAPI, generated from the zod schemas
pnpm verify                                 # the full gate
pnpm lab 01                                 # a module's lab check (red until it is built)
```

See the course's Chapter 00 for details. The MCP Inspector (`pnpm mcp:inspect:ui`) is used
from module 5, once the app serves MCP.

## Call it from Postman

`postman/nest-ai-starter.postman_collection.json` holds every REST and MCP call the course
labs make. Import it; `baseUrl` is `http://localhost:3000`.
Folders are numbered by chapter and named by module, and every request carries tests (the
Test Results tab). A folder works once its module is built. From module 3 on, 03 signs up
the demo user and logs in (the token goes to the `token` variable), and 04 provisions the
device whose key and secret the MCP folders use.

**Provisioning stores a live device secret in a collection
variable: never export or share the collection after a run.**

## Add a resource

```bash
pnpm exec nest g resource orders --type rest --crud     # 1. nest-cli
pnpm resource:template --name order --plural orders     # 2. templates
# 3. ask your agent: "fill the AI-FILL markers for orders from specs/orders.md"
pnpm verify                                             # 4. proof
```

See `CLAUDE.md` for conventions and `.claude/skills/nest-resource-scaffold/SKILL.md` for
the full procedure. `src/notes` + `specs/notes.md` is a finished example.

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
