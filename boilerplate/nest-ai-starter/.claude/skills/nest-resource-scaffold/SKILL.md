---
name: nest-resource-scaffold
description: Add a new REST resource (CRUD endpoints, service, schema, tests) to this NestJS service. Use whenever a task says "add an endpoint/resource/entity/API for X". Runs nest-cli, then the repo templates, then fills only the AI-FILL markers from a written spec, and finishes with pnpm verify.
---

# Add a REST resource: generate → template → fill → verify

A resource is built in three steps, each done by the right tool:

| step | who                 | what it produces                                                                                 | why this tool                                                                 |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1    | **nest-cli**        | folder, module, controller/service stubs, `AppModule` import                                     | the framework's own wiring, done the framework's way                          |
| 2    | **template script** | the house conventions: zod schema, DTOs, repository token, service, controller, unit + e2e specs | deterministic, so every resource looks the same no matter which agent made it |
| 3    | **you (the agent)** | the domain: fields, business rules, rule tests                                                   | needs judgement, and is confined to `AI-FILL` markers                         |

Do not skip or reorder steps. Do not hand-write what step 1 or 2 generates.

## 0. Preconditions

- A spec exists at `specs/<plural>.md`, with fields, rules and the error each rule raises.
  If it is missing, write one with the `resource-spec` skill and get it confirmed
  **before** step 1. Never invent fields or rules.
- `pnpm verify` passes **before** you start. If it does not, stop and report: you would not
  be able to tell your breakage from the existing one.

## 1. Generate with nest-cli

```bash
# answer the prompts with the defaults: REST API, generate CRUD entry points = Yes
printf '\n\n' | pnpm exec nest g resource <plural>
```

- nest-cli 11 rejects `--type`/`--crud` flags and prompts instead. Piping the two default
  answers is the non-interactive form.
- **Check the result, not the exit code:** `src/<plural>/<plural>.module.ts` exists, and
  `src/app.module.ts` imports `<Plural>Module`.

## 2. Apply the templates

```bash
pnpm resource:template --name <singular> --plural <plural>
# e.g. --name line-item --plural line-items  (lower kebab-case, plural given explicitly)
```

- The script refuses to run if step 1 has not run, and refuses to overwrite a resource it
  has already templated (`--force` discards fill work, so do not use it on filled code).
- It prints every file written and the number of `AI-FILL` markers. Note that number: it
  is your to-do list.
- At this point `pnpm typecheck` and `pnpm lint:check` already pass. If they do not, the
  templates are broken: stop and report it rather than patching around it.

## 3. Fill every AI-FILL marker from the spec

List them with `pnpm check:ai-fill`. Each marker names its topic:

| marker                          | file                  | fill with                                                                |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `fields`                        | `<name>.schema.ts`    | one zod line per spec field, with constraints and defaults               |
| `payload-rules`                 | `<name>.schema.ts`    | `.refine()` for rules that need **only the request** (cross-field)       |
| `create-rules` / `update-rules` | `<plural>.service.ts` | rules that need **stored state**, each throwing a `DomainError` subclass |
| `valid-input`                   | unit + e2e spec       | a minimal valid payload                                                  |
| `rule-tests` / `rule-e2e`       | specs                 | for each rule, the allowed case **and** the refused case                 |

Placement rule: **payload-only → schema (400). Needs stored state → service (422/409).**

Delete each marker comment once it is handled. If the spec has no rule for a marker,
replace the marker with an explicit sentence such as `// No create-time rules.`, so the
next reader knows it was considered and not forgotten.

## 4. Verify

```bash
pnpm verify    # typecheck, lint, no AI-FILL/stub left, unit tests, e2e tests
```

Then prove the rule tests can fail. For **each** service rule:

1. Delete the rule.
2. Run `pnpm test -- src/<plural>`.
3. At least one test must fail.
4. Restore the rule.

A rule whose deletion leaves the tests green is not tested.

- Read the counts, not the exit code: `Tests: N passed`, where N went up by the number of
  tests you added.
- A bug at the HTTP boundary (validation, defaults, status codes) can only be caught by
  the **e2e** spec. Service unit tests receive already-parsed objects.

## Known traps (measured in this repo)

- **PATCH and defaults:** `.partial()` of fields with `.default()` re-applies the defaults,
  so `PATCH {title}` would wipe other fields. The template uses `patchSchema()` for this.
  Keep it.
- **Zod 4 and refined objects:** `.omit()`/`.partial()` throw on an object that has a
  `.refine()`. Refine the _derived_ schema last, as the template does.
- **All-optional resources:** the template's e2e test "invalid body is 400" assumes at
  least one required field. If the spec has none, change that test and say why.

## Report

End with:

- the resource and its route;
- the file list from step 2;
- marker count from step 2, then 0 after step 3;
- test counts before and after;
- the mutation result per rule;
- anything in the spec you could not implement, with the reason.
