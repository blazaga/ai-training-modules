# Module 10 — Skills and templated code: building a NestJS service with agents

## Why it matters

Ask three agents to "add an orders endpoint" and you get three different services: one
validates with class-validator, one with nothing; one returns `{ success: false }` with
HTTP 200, one throws; one tests the controller, one tests nothing. Each looks reasonable
and none matches the others. Agents are not bad at code. They are **unconstrained**, and
every unconstrained choice is made again, differently, each time.

The reference service in this estate shows what that drift looks like after a year:
errors returned as HTTP 200, request bodies typed inline without validation, deep relative
imports despite configured path aliases, and the whole config, including a database URL,
printed at startup.

## The principle

> **Let each tool do what it is best at. The framework generates structure, templates fix
> conventions, agents supply judgement, and a gate proves the result.**

| layer       | tool                                         | decides                                                           | repeatable?                        |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| structure   | `nest g resource`                            | folders, module wiring, `AppModule` import                        | yes: the framework's own generator |
| conventions | `templates/resource/*.tpl` + a render script | validation, errors, data access, controller shape, test skeletons | yes: same input, same bytes        |
| domain      | an AI agent + skills                         | fields, business rules, rule tests                                | **no, so it is fenced in**         |
| proof       | `pnpm verify`                                | did all of the above actually happen?                             | yes                                |

The agent works only inside `// AI-FILL(topic): …` markers. The gate fails while any
marker is left. That turns "the agent says it finished" into a count that must be zero.

## The boilerplate

`boilerplate/nest-ai-starter/` is in this repository and can be split into its own repo.
It is NestJS 11, zod 4 with `nestjs-zod`, `@nestjs/config`, Swagger and jest + supertest,
with every version pinned exactly.

```
.claude/skills/          the agent's playbooks (below)
CLAUDE.md                conventions + which skill to load for which task
src/common/              errors, filter, repository port, page + patch schemas
src/config/env.schema.ts every env var, validated at boot
src/bootstrap/           prefix, versioning, docs: shared by main.ts AND e2e tests
src/notes/ + specs/notes.md   the finished worked example and its spec
templates/resource/      the house templates
scripts/                 apply-resource-template.mjs, check-ai-fill.mjs
```

### Why Nest 11 and not 12

`nestjs-zod` declares `@nestjs/common ^10 || ^11` as a peer dependency, in both the version
the reference service uses and the latest one. The choice follows a measured constraint,
not a preference, and the README says when to revisit it.

## The skills: what was reused, what had to be written

A survey of the 42 project skills and 37 local skills found that **one** could be copied
as-is. Most of what this workflow needs did not exist anywhere:

| skill                    | origin                                               | role                                                                                                     |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `nestjs-best-practices`  | copied (MIT, 40 rules)                               | general NestJS judgement. Its examples use class-validator, so `CLAUDE.md` says the repo's zod rule wins |
| `karpathy-guidelines`    | copied **verbatim from upstream** at a pinned commit | think first, simple, surgical, verifiable                                                                |
| `resource-spec`          | **new**                                              | write the spec the agent fills from, and hunt for gaps                                                   |
| `nest-resource-scaffold` | **new**                                              | the four-step workflow, its traps and its report                                                         |
| `nest-verify`            | **new**                                              | the gate, the controls that prove each check can fail, which layer catches what                          |
| `env-config`             | **new**                                              | add a setting without ever logging its value                                                             |
| `plan-feature`           | adapted from the estate's `writing-plans`            | plan multi-step work with a verify line per task                                                         |
| `worklog-handoff`        | **new**                                              | leave a record a stranger can resume                                                                     |

Two decisions are worth copying:

- **Copy upstream skills verbatim and keep local rules elsewhere.** The workstation copy of
  `karpathy-guidelines` carried four "local overrides" that this estate had since retired.
  The boilerplate takes the upstream file at a recorded commit, confirms it is
  byte-identical, and puts project rules in `CLAUDE.md`. A modified copy of a shared skill
  is the module 2 failure: rules living where nobody looks.
- **Put the skills where the harness loads them.** `.claude/skills/<name>/SKILL.md` was
  picked up by the agent harness as soon as it was written. That is a positive control
  that the location reaches the agent.

## The workflow, end to end

```bash
# 0. spec first (skill: resource-spec)
$EDITOR specs/orders.md
# 1. structure
printf '\n\n' | pnpm exec nest g resource orders
# 2. conventions
pnpm resource:template --name order --plural orders     # prints: files written, AI-FILL count
# 3. domain: the agent fills every AI-FILL marker from specs/orders.md
# 4. proof
pnpm verify
```

The template script fails closed. It refuses to run before step 1, refuses to overwrite a
resource it already templated, and refuses names that are not lower kebab-case. It never
guesses a plural.

## What building it taught (all measured, all fixed in the boilerplate)

Each of these went into a template, a skill or a test, so the next agent does not
rediscover it.

1. **The generator exited 0 and put the files somewhere else.** `nest new --directory
<absolute path>`, run from another directory, wrote under the _current_ directory and
   reported success. The scaffold was found by looking for it, not by trusting the exit
   code (module 5).
2. **Flags the CLI does not know are rejected, not ignored.** `nest g resource --type rest
--crud` failed. The generator only accepts those answers through prompts, so the skill
   pipes the defaults in.
3. **`.partial()` re-applies defaults.** In zod 4.4.3, `PATCH {"title":"x"}` parsed to
   `{title, body:'', status:'draft', tags:[]}`. Every update would have wiped fields and
   un-published notes. The fix is a shared `patchSchema()` helper, plus a test that pins
   the zod behaviour as a control, so a future zod upgrade that changes it is noticed.
4. **Zod 4 throws on `.omit()`/`.partial()` of a refined object.** The template derives
   create and update schemas from an _unrefined_ field set and refines last.
5. **The unit layer could not see bug 3.** With the PATCH bug planted back in, all 10
   service unit tests stayed green, because they receive already-parsed objects. The e2e
   suite caught it (2 failures). A bug at the HTTP boundary needs a test at the boundary.
6. **Every rule was mutation-checked.** Deleting R3, R4 or R5 from the service turned
   exactly one test red each. A rule nobody has tried deleting is a rule nobody has proven
   is tested.
7. **A test that passes for the wrong reason.** "Config errors never echo the value" stays
   green even if the code prints zod's whole error, because zod 4.4.3 happens not to
   include inputs. The test guards the mistake that matters (dumping the raw env), and the
   code comment was reworded to claim only what was measured.
8. **A false comment, caught by reading the formatted code.** "Docs off by default in
   production" sat above code that defaulted to on. The code was changed to match the
   comment, and a test now pins it.
9. **`pnpm` was not on PATH, so `verify` called the binaries directly.** A gate that only
   works on the author's machine is not a gate.
10. **A spec gap found while writing the spec.** "Create as published needs a body" left
    "PATCH a draft to published with no body" open. It became rule R5, raised in the spec
    rather than invented in code.

## Labs

### Lab 10.1: add a resource (90 min)

Write `specs/orders.md`: customer name, an amount in cents (integer, > 0), a status
`pending | paid | cancelled`, and two rules of your choice, at least one of which needs
stored state. Run the four steps with your agent.

_Hand in:_ the spec; the template script's output (files + marker count); `pnpm verify`
output with both `Tests:` lines; one mutation result per service rule.

### Lab 10.2: change a convention once, everywhere (45 min)

Add `?sort=createdAt|-createdAt` to every list endpoint. Change **only**
`templates/resource/` and `src/common/`, then re-render a scratch resource to prove that
new resources get the change.

_Discuss:_ how do existing resources pick up a template change? What would a safe
"re-template" look like, given that `--force` discards AI-FILL work?

### Lab 10.3: write a skill (45 min)

Write `.claude/skills/postgres-repository/SKILL.md`: replace `InMemoryRepository` with a
Postgres adapter for one resource, without touching its service or tests. Give it a
description that triggers on the words a ticket would use.

_Check:_ a fresh agent session, given only "store orders in Postgres", loads your skill.

### Lab 10.4: break the gate (30 min)

Find a way to make `pnpm verify` pass while the work is not actually done. (Hint: what
does `check-ai-fill` not look for?) Then close the hole and add a test or control for it.

## Anti-patterns

- **Editing a generated file instead of the template.** It fixes one resource and leaves
  the next one broken.
- **Letting the agent write outside AI-FILL regions "to help".** Every byte outside a
  marker is supposed to be identical across resources.
- **A spec in chat.** If it is not in `specs/`, the next session cannot see it.
- **"All tests pass" without counts and mutations.** See modules 5 and 6.
