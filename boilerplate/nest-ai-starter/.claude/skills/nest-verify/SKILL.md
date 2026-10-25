---
name: nest-verify
description: Verify a change to this NestJS service before calling it done - typecheck, lint, AI-FILL check, unit and e2e tests, plus the controls that prove each check can fail. Use before every commit, before reporting work as finished, and whenever a check passes suspiciously quietly.
---

# Verify: ask the artefact, not the exit code

`pnpm verify` runs, in order and stopping at the first failure:

| check        | command                            | what a real pass looks like                           |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| types        | `tsc --noEmit`                     | no output, exit 0                                     |
| lint         | `eslint "{src,test}/**/*.ts"`      | no output, exit 0                                     |
| completeness | `node scripts/check-ai-fill.mjs`   | `AI-FILL markers: 0` and `stub bodies: 0` **printed** |
| unit         | `jest`                             | `Tests: N passed`, where N is what you expect         |
| e2e          | `jest --config test/jest-e2e.json` | `Tests: N passed`, where N is what you expect         |

## Controls: prove each check can fail

A check that has never failed in front of you is a hypothesis. Run these once per
session, and again after changing any config:

- **typecheck:** create `src/__planted.ts` containing
  `export const x: number = 'no';` and confirm `pnpm typecheck` reports `TS2322`.
  Then delete the file.
- **tests:** delete one business rule from a service and confirm a test fails. Then
  restore it. Do this for every rule you added.
- **test selection:** when you run a subset (`pnpm test -- src/notes`), confirm the
  summary names the suites you meant. A filter that matches nothing can still exit 0.

## Read output, not status

- After a pipe, `$?` belongs to the last command. Use `${PIPESTATUS[0]}`, or do not pipe.
- `Tests: 0 total`, `No tests found` or a missing summary line is a **failure**, whatever
  the exit code says.
- When an e2e test passes, check that it went through `configureApp(app)`. Without it the
  prefix and versioning differ from production, and the test proves nothing about
  `/api/v1`.

## Which layer catches what

| bug                                         | caught by                                             |
| ------------------------------------------- | ----------------------------------------------------- |
| wrong type, missing import                  | typecheck                                             |
| business rule missing or wrong              | service unit test                                     |
| validation, defaults, status codes, routing | **e2e only**, because unit tests get pre-parsed input |
| AI step left unfinished                     | `check:ai-fill`                                       |

## Report

Paste the summary lines: typecheck and lint exit codes, the check-ai-fill counts, both
`Tests:` lines, and the controls you ran with their results. Never write "tests pass"
without the numbers.
