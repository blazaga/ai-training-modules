# nest-ai-starter

A NestJS 11 REST service designed to be built **with AI agents**. nest-cli generates the
structure, repo templates apply the conventions, and agents fill only marked gaps from a
written spec. Every change ends with `pnpm verify`.

## Quick start

```bash
corepack pnpm install      # or `pnpm install` if pnpm is on PATH
cp .env.example .env
corepack pnpm start:dev    # http://localhost:3000/api/health, docs at /api/docs
corepack pnpm verify       # typecheck, lint, AI-FILL check, unit, e2e
```

`.npmrc` sets `frozen-lockfile=true`. To change dependencies on purpose, run
`pnpm install --no-frozen-lockfile` and commit the lockfile.

## Skills: load before acting

Skills live in `.claude/skills/`.

| task | skill |
|---|---|
| any code change | `karpathy-guidelines`, `nestjs-best-practices` |
| add an endpoint/resource | `resource-spec` first, then `nest-resource-scaffold` |
| add a setting or secret | `env-config` |
| multi-step or multi-session work | `plan-feature` |
| before saying "done" | `nest-verify` |
| end of every session | `worklog-handoff` |

`nestjs-best-practices` shows class-validator DTOs in its examples. **This repo uses zod
via `nestjs-zod`**, and this file wins wherever the two disagree.

## Layout

```
src/
├── main.ts                     bootstrap: listen and log the port only
├── app.module.ts               ConfigModule (validated), global ZodValidationPipe + DomainExceptionFilter
├── bootstrap/configure-app.ts  prefix /api, URI versioning v1, swagger; shared by main.ts AND e2e
├── config/env.schema.ts        the ONLY place env vars are declared and validated
├── common/
│   ├── errors/domain-error.ts      NotFoundError 404 · ConflictError 409 · RuleViolationError 422
│   ├── filters/                    DomainError → HTTP, one error body shape
│   ├── persistence/repository.ts   Repository<T> port + InMemoryRepository adapter
│   └── schemas/                    PageQuery (?limit&offset), patchSchema (PATCH without defaults)
├── health/                     GET /api/health (unversioned)
└── <resource>/                 one folder per resource, generated - see below
templates/resource/             the house templates (step 2)
scripts/                        apply-resource-template.mjs, check-ai-fill.mjs
specs/<plural>.md               one spec per resource; the input for step 3
```

## Adding a resource: always three steps

1. `printf '\n\n' | pnpm exec nest g resource <plural>` (nest-cli: wiring)
2. `pnpm resource:template --name <singular> --plural <plural>` (templates: conventions)
3. Fill every `AI-FILL(...)` marker from `specs/<plural>.md`, then run `pnpm verify`.

Full procedure and traps: `.claude/skills/nest-resource-scaffold/SKILL.md`. `src/notes/`
is the finished worked example, and `specs/notes.md` is its spec.

## Conventions

- **Validation:** zod schemas are the single source of truth. DTOs are
  `class X extends createZodDto(Schema)`. Never hand-write a field in two places.
- **Placement of rules:** a rule that needs only the payload goes in the schema (400). A
  rule that needs stored state goes in the service and throws a `DomainError` (422/409).
- **Errors:** services throw `DomainError` subclasses. Never `return { success: false }`
  with HTTP 200, and never try/catch in controllers.
- **Controllers:** parse, delegate, return. Use `ParseUUIDPipe` on ids. A successful
  DELETE returns 204.
- **Data access:** inject the repository **token** (`<PLURAL>_REPOSITORY`), never a class.
  Storage is swapped in the module only.
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
