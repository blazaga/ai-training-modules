# Chapter 01 — Starting from the CLI and templates

**You will:** create a NestJS 12 service with nest-cli, then add a REST resource in three
steps: generate → template → fill. The fill step is the agent's job, and a gate proves the
result. **Code:** `boilerplate/nest-ai-starter/`, worked example `src/notes/` +
`specs/notes.md`.

## Why this shape

Ask three agents to "add an orders endpoint" and you get three different services: one
validates input, one does not; one returns `{ success: false }` with HTTP 200, one throws.
None is wrong in isolation. Each agent is **unconstrained**, so every choice gets made
again, differently, each time. The reference service in this estate shows what a year of
that drift looks like: errors returned as 200, request bodies typed inline without
validation, and the whole config, database URL included, printed at startup.

The fix is to give each kind of work to the tool best suited to it:

| step           | tool                                                               | decides                                                                         | repeatable?                        |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------- |
| 1. structure   | `nest g resource`                                                  | folders, module wiring, `AppModule` import                                      | yes: the framework's own generator |
| 2. conventions | `templates/resource/*.tpl` + `scripts/apply-resource-template.mjs` | validation, errors, data access, controller shape, test skeletons               | yes: same input, same bytes        |
| 3. domain      | an AI agent + `.claude/skills/`                                    | fields, business rules, rule tests, **only inside `// AI-FILL(topic)` markers** | no, so it is fenced in             |
| 4. proof       | `pnpm verify`                                                      | did all of the above happen?                                                    | yes                                |

## Create the project (what we measured on nest-cli 12.0.10)

```bash
npx @nestjs/cli@12 new nest-ai-starter --package-manager pnpm --strict
```

A fresh Nest 12 project differs from Nest 11 in toolchain, not just version:
**ESM** (`"type": "module"`; every relative import ends in `.js`), **TypeScript 6**,
**vitest** instead of jest, and **oxlint** instead of eslint. The starter keeps all of those
defaults, so it looks like your own `nest new` plus a course layer.

Things we hit on the way, all reproducible:

- `nest new --directory /absolute/path`, run from another directory, wrote the project
  under the **current** directory and still exited 0. Find the files before trusting the
  exit code (P5).
- pnpm 12 (what corepack installs today) **ignores `frozen-lockfile` in `.npmrc`**. A
  deliberately drifted `package.json` installed with exit 0 and rewrote the lockfile. The
  setting moved to `pnpm-workspace.yaml` (`frozenLockfile: true`), and the same drift is
  now refused with `ERR_PNPM_OUTDATED_LOCKFILE`.
- pnpm 12 **fails** an install when a dependency wants to run an install script. Swagger UI
  pulls in `@scarf/scarf`, an install-time telemetry package; it is **denied**
  (`allowBuilds: false`), not approved to make the error go away. drizzle-kit's esbuild
  scripts are denied too, and drizzle-kit still works.
- `nestjs-zod` has no release that supports Nest 12 (its peer range is `^10 || ^11`), so
  the starter carries a ~60-line adapter in `src/common/zod/` with the same
  `createZodDto(Schema)` shape. OpenAPI is generated from the same zod schemas via
  `z.toJSONSchema`.

## The three steps, for real

```bash
# 0. spec first: copy specs/notes.md (skill: resource-spec)
# 1. structure
pnpm exec nest g resource notes --type rest --crud
# 2. conventions (+ --storage drizzle in chapter 02)
pnpm resource:template --name note --plural notes
#   → at the ch01 commit: files written: 10; AI-FILL markers to complete: 8
#   → with the final templates (after ch02–ch04): 11 files, 16 markers
# 3. the agent fills every marker from specs/notes.md  (skill: nest-resource-scaffold)
# 4. proof
pnpm verify
```

nest-cli 11 rejected `--type` and `--crud` and had to be fed prompt answers through a
pipe; nest-cli 12 accepts them. We checked that the flag is honoured, not silently ignored:
`--type graphql-code-first` produced resolvers instead.

**What step 1 hands you** (nest-cli's own output): empty DTOs, string stubs such as
`'This action adds a new note'`, and `+id` coercing a path parameter with no validation.
**What step 2 adds:** a zod schema as the single source of truth, DTOs derived from it,
a repository port, `DomainError`s mapped to HTTP in one filter, `ParseUUIDPipe`, a
response schema that strips private fields, and unit + e2e test skeletons. At this point
`typecheck` and `lint` already pass, while `verify` refuses because the markers remain.

## The markers (the agent's whole surface)

| marker                                               | where      | what goes in it                                                       |
| ---------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `fields`                                             | schema     | one zod line per spec field                                           |
| `private-fields` / `server-fields`                   | schema     | stored but never returned / returned but never accepted               |
| `payload-rules`                                      | schema     | `.extend()` write-only inputs, `.refine()` payload-only rules (→ 400) |
| `queries` / `queries-impl`                           | repository | extra lookups (`findByEmail`)                                         |
| `create-rules` / `update-rules` / `remove-rules`     | service    | rules needing stored state (→ 422/409)                                |
| `create-mapping`                                     | service    | write-only inputs → private fields (fails to compile until done)      |
| `access-create`                                      | controller | `@Public()` only if creation is public (chapter 03)                   |
| `valid-input`, `e2e-setup`, `rule-tests`, `rule-e2e` | specs      | payloads, auth setup, one allowed + one refused case per rule         |

`scripts/check-ai-fill.mjs` fails while any marker or nest-cli stub body remains, and it
**prints the count** either way. "The agent says it's done" is a claim; zero markers is the
artefact.

## Measured traps the templates now handle

1. **`.partial()` re-applies defaults** (zod 4.4.3 and 4.6.7): `PATCH {"title":"x"}`
   parsed to `{title, body:'', status:'draft', tags:[]}`, which would wipe fields and
   un-publish notes on every update. Hence `patchSchema()`, plus a control test that fails
   if a zod upgrade changes this behaviour.
2. **Zod 4 throws on `.omit()`/`.partial()` of a refined object.** Templates refine last.
3. **The unit layer could not see trap 1.** With the bug planted back in, all 10 service
   unit tests stayed green (they get pre-parsed objects) and 2 e2e tests failed. A bug at
   the HTTP boundary needs a test at the boundary.
4. **A validation pipe that returned the RAW input was caught by no e2e test.** Every
   resource now gets "unknown keys are stripped".

## Verify

```bash
pnpm verify   # tsc · oxlint · prettier --check · check:ai-fill · check:migrations · unit · e2e
```

Read the counts, not the exit code. In this chapter's state: unit `Tests 22 passed`, e2e
`Tests 14 passed`. Then prove the tests can fail: delete each service rule once and watch
exactly one test go red (skill `nest-verify`).

## Labs

Lab 1 is checked. The exact contract (fields, rules O1 and O2, status codes) is in
`boilerplate/nest-ai-starter/test/labs/README.md`: write it into `specs/orders.md` first,
build, then run `pnpm lab 01` until every test passes.

1. **Add `orders`** from a spec you write (two rules, one needing stored state). Hand in:
   the spec, the template output (file count + marker count), `verify` output with both
   `Tests` lines, and one mutation result per rule.
2. **Change a convention once, everywhere:** add `?sort=` to every list via
   `templates/resource/` + `src/common/`, then re-render a scratch resource.
3. **Break the gate:** make `verify` pass while the work is not done. (Hint: what does
   `check-ai-fill` not look for?) Then close the hole.

Principles behind this chapter: P2 (context files), P3 (skills), P5 (verification).
