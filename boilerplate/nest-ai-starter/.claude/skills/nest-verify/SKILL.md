---
name: nest-verify
description: Verify a change to this NestJS service before calling it done - typecheck, lint, AI-FILL check, unit and e2e tests, plus the controls that prove each check can fail. Use before every commit, before reporting work as finished, and whenever a check passes suspiciously quietly.
---

# Verify: ask the artefact, not the exit code

`npm run verify` runs, in order and stopping at the first failure:

| check        | command                                         | what a real pass looks like                           |
| ------------ | ----------------------------------------------- | ----------------------------------------------------- |
| types        | `tsc --noEmit`                                  | no output, exit 0                                     |
| lint         | `oxlint --type-aware src/ test/`                | no output, exit 0                                     |
| format       | `prettier --check "src/**/*.ts" "test/**/*.ts"` | `All matched files use Prettier code style!`          |
| completeness | `node scripts/check-ai-fill.mjs`                | `AI-FILL markers: 0` and `stub bodies: 0` **printed** |
| unit         | `vitest run`                                    | `Tests  N passed (N)`, where N is what you expect     |
| e2e          | `vitest run --config ./vitest.config.e2e.ts`    | `Tests  N passed (N)`, where N is what you expect     |

## Controls: prove each check can fail

A check that has never failed in front of you is a hypothesis. Run these once per
session, and again after changing any config:

- **typecheck:** create `src/__planted.ts` containing
  `export const x: number = 'no';` and confirm `npm run typecheck` reports `TS2322`.
  Then delete the file.
- **lint:** add `async function f(): Promise<void> {}` and an un-awaited `f();` in a scratch
  file and confirm oxlint reports `no-floating-promises`. oxlint is silent when clean, so the
  silence means nothing until you have seen it fail.
- **tests:** delete one business rule from a service and confirm a test fails. Then
  restore it. Do this for every rule you added.
- **test selection:** when you run a subset (`npx vitest run src/notes`), confirm the
  summary names the suites you meant. A filter that matches nothing can still exit 0.

## Read output, not status

- After a pipe, `$?` belongs to the last command. Use `${PIPESTATUS[0]}`, or do not pipe.
- `Tests: 0 total`, `No tests found` or a missing summary line is a **failure**, whatever
  the exit code says.
- **`skipped` is not `passed`.** When a `beforeAll` throws (e.g. the e2e setup cannot sign
  up its user), vitest SKIPS that file's tests. The `Tests` line then shows **no failures**
  (`2 passed | 30 skipped`). The failure is only on the `Test Files … failed` line and in
  the exit code. Read all three. Measured in this repo with sign-up made non-public.
- When an e2e test passes, check that it went through `configureApp(app)`. Without it the
  prefix and versioning differ from production, and the test proves nothing about
  `/api/v1`.

## Which layer catches what

| bug                                         | caught by                                             |
| ------------------------------------------- | ----------------------------------------------------- |
| wrong type, missing import                  | typecheck                                             |
| business rule missing or wrong              | service unit test                                     |
| validation, defaults, status codes, routing | **e2e only**, because unit tests get pre-parsed input |
| validation pipe passes raw input through    | e2e "unknown keys are stripped" + the pipe's own spec |
| AI step left unfinished                     | `check:ai-fill`                                       |

## Report

Paste the summary lines: typecheck and lint exit codes, the check-ai-fill counts, both
`Tests:` lines, and the controls you ran with their results. Never write "tests pass"
without the numbers.
