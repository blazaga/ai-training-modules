# nest-ai-starter

A NestJS 11 REST starter for building services **with AI agents, skills and templated
code**. It is the hands-on companion to the course in `docs/ai-agent-training/`.

The idea: split every piece of work by who does it best.

| layer       | tool                                                          | output                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| structure   | `nest g resource`                                             | module, controller and service stubs, `AppModule` wiring                |
| conventions | `templates/resource/` + `scripts/apply-resource-template.mjs` | schemas, DTOs, repository, service, controller, specs, always identical |
| domain      | an AI agent, guided by `.claude/skills/`                      | fields, business rules and their tests, only inside `AI-FILL` markers   |
| proof       | `pnpm verify`                                                 | typecheck, lint, zero markers left, unit + e2e tests                    |

## Run it

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm start:dev
curl localhost:3000/api/health          # {"status":"ok"}
open http://localhost:3000/api/docs     # OpenAPI, generated from the zod schemas
corepack pnpm verify
```

## Add a resource

```bash
printf '\n\n' | corepack pnpm exec nest g resource orders     # 1. nest-cli
corepack pnpm resource:template --name order --plural orders  # 2. templates
# 3. ask your agent: "fill the AI-FILL markers for orders from specs/orders.md"
corepack pnpm verify                                          # 4. proof
```

See `CLAUDE.md` for conventions and `.claude/skills/nest-resource-scaffold/SKILL.md` for
the full procedure. `src/notes` + `specs/notes.md` is a finished example.

## What is in the box

- Nest 11, TypeScript 5.9, zod 4 + `nestjs-zod`, `@nestjs/config`, `@nestjs/swagger`,
  jest 30 + supertest. All versions pinned exactly.
- `/api/v1/...` URI versioning, unversioned `/api/health`, and OpenAPI docs
  (disabled by default when `NODE_ENV=production`).
- Env validated at boot. Bad config stops the process with the variable **name**, never
  its value.
- One error shape: `DomainError` → 404/409/422, and validation → 400.
- A repository port with an in-memory adapter, swappable per module.
- A multi-stage Dockerfile that runs as a non-root user and has a health check.

## Why Nest 11, not 12

`nestjs-zod` (5.1.1 through 5.5.0) declares `@nestjs/common ^10 || ^11` as a peer
dependency. Upgrade once it supports 12.
