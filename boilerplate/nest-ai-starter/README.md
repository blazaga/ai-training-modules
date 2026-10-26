# nest-ai-starter

A NestJS 12 REST starter for building services **with AI agents, skills and templated
code**. It is the hands-on companion to the course in `docs/ai-agent-training/`.

The idea: split every piece of work by who does it best.

| layer       | tool                                                          | output                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| structure   | `nest g resource`                                             | module, controller and service stubs, `AppModule` wiring                |
| conventions | `templates/resource/` + `scripts/apply-resource-template.mjs` | schemas, DTOs, repository, service, controller, specs, always identical |
| domain      | an AI agent, guided by `.claude/skills/`                      | fields, business rules and their tests, only inside `AI-FILL` markers   |
| proof       | `pnpm verify`                                                 | typecheck, lint, zero markers left, unit + e2e tests                    |

## Run it (Docker only: no local Node needed)

```bash
docker compose up -d --build                # Postgres + Redis → migrate → app
curl localhost:3000/api/health              # {"status":"ok"}
open http://localhost:3000/api/docs         # OpenAPI, generated from the zod schemas
docker compose run --rm dev pnpm verify     # the full gate, in the toolbox container
docker compose --profile inspector up -d inspector   # MCP Inspector web UI on localhost:6274
```

Services: `db` (Postgres 17), `redis` (Redis 8, infrastructure for later chapters; not
used by the app yet), `migrate` (one-shot), `app`, `dev` (the toolbox, profile `dev`) and `inspector` (the MCP Inspector web UI, profile
`inspector`; `docker compose logs inspector` prints its URL with a token, and in the UI you add
`http://app:3000/mcp` as a `streamable-http` server with your device's two headers).
See the course's Chapter 00 for details.

## Call it from Postman

`postman/nest-ai-starter.postman_collection.json` holds every REST and MCP call the course
labs make. Import it; `baseUrl` is `http://localhost:3000`.
Folders are numbered by chapter, and every request carries tests (the Test Results tab).
Run the folders in order the first time: 03 signs up the demo user, and 04 issues the device
credentials that the MCP folders use.

**Issuing credentials stores a live device secret in a collection
variable: never export or share the collection after a run.**

## Add a resource

```bash
T="docker compose run --rm dev"
$T pnpm exec nest g resource orders --type rest --crud     # 1. nest-cli
$T pnpm resource:template --name order --plural orders     # 2. templates
# 3. ask your agent: "fill the AI-FILL markers for orders from specs/orders.md"
$T pnpm verify                                             # 4. proof
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
- A repository port with an in-memory adapter, swappable per module.
- A multi-stage Dockerfile that runs as a non-root user and has a health check.

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
