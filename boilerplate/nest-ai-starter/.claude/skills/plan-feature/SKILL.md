---
name: plan-feature
description: Plan a multi-step feature for this NestJS service before writing code - research, design, ordered tasks with a verification for each. Use when a task touches more than one resource, adds infrastructure (database, queue, auth), or will take more than one session.
---

# Plan before you build

Adapted from the reference project's `writing-plans` skill, with its project-specific
tooling removed. Write the plan to `plans/<YYYY-MM-DD>-<slug>.md` and commit it with the
work.

## 1. Research (read, do not write)

- Which existing modules, schemas and services does this touch? List the files.
- Which skills apply? Always `nestjs-best-practices` and `karpathy-guidelines`; plus
  `nest-resource-scaffold` for new resources and `env-config` for new settings.
- For any library you will call: read its **installed** version's types or docs, not
  memory. Example from this repo: zod 4 throws on `.partial()` of a refined object, which
  was found by running it.

## 2. Design

- One paragraph on what changes and why.
- New or changed **schemas** (zod), because they are the contract.
- New **errors** and the HTTP status each one maps to.
- What you are deliberately **not** doing.
- Open questions. If any of them block the work, stop here and ask.

## 3. Tasks

An ordered list. Each task is small enough to verify on its own:

```markdown
- [ ] T1 <what> - files: <...> - verify: <exact command + expected output>
```

A task without a verify line is not a task. "Tests pass" is not a verify line;
`pnpm test -- src/orders → Tests: 12 passed` is.

## 4. Execute

Work the list in order, run `pnpm verify` after each task, tick the box, and record
progress with the `worklog-handoff` skill. If the plan turns out wrong, edit the plan and
say why. Do not quietly drift from it.
