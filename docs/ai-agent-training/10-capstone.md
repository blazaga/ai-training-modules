# Chapter 10 — Capstone: one feature through every layer, with evidence

**You will:** use agents and the starter's skills to deliver one feature that touches a
resource, auth, ownership and MCP. The grade is the **evidence package**, not the feature.

## The feature

**Device-scoped notes.** Notes get an owner (the authenticated user over REST, the
device's owner over MCP); a new MCP tool `my-notes` lists only the caller's notes; another
user's note is 404 over REST and a `NOT_FOUND` tool error over MCP.

## Steps and required evidence

| #   | step                                                                             | evidence                                                                                                                |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Update `specs/notes.md` (skill `resource-spec`): owner field, rules, gaps found  | the spec diff and every open question you raised                                                                        |
| 2   | Plan (skill `plan-feature`): tasks, each with a verify line                      | `plans/<date>-notes-ownership.md`                                                                                       |
| 3   | Schema, table, migration. Read the generated SQL before applying it (chapter 04) | the migration, and what you hand-edited and why                                                                         |
| 4   | Service + controller ownership (chapter 04 pattern)                              | unit + e2e counts; the owner-check mutation result                                                                      |
| 5   | MCP tool `my-notes` using `McpContext` (chapter 09)                              | the e2e test with two devices of two users                                                                              |
| 6   | `pnpm verify`                                                                    | all output lines: tsc, oxlint, prettier, check-ai-fill, check-migrations, both `Tests` lines **and** `Test Files` lines |
| 7   | Inspector CLI capture with headers (secret redacted)                             | the capture                                                                                                             |
| 8   | WORKLOG entry (skill `worklog-handoff`) with any corrections you made            | the entry                                                                                                               |

## Grading

- **Pass:** every row has evidence that could not have been produced by doing nothing.
- **Distinction:** you found a false statement in a comment, skill, spec or this course,
  measured it, and corrected it with the measurement.
- **Rework:** "tests pass" without counts; a credential or token in any artefact; a
  generated migration applied without being read.
