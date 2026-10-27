# Dry run: the whole guided course, one step file at a time

**Run:** 2026-10-27, Asia/Manila afternoon. One fresh agent session, on a clean copy of the
training repo's starter (no `.env`, no `node_modules`). It was given exactly what a learner
types, one message per step, and nothing else:

```text
Read steps/01-set-up.md and do what it says.
```

After each step the proctor (not the agent) checked the project's git diff, the seeded
database and the checks, then sent the next step.

| step               | agent did                                                                                                                                                                                                       | checked afterwards                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-set-up.md`     | `npm install`; created `.env` from `.env.example` (only `PORT` changed, 3000 was taken on the host); verify unit 21 / e2e 5; described the 25 users, 200 notes, 120 shares; stopped                             | only `WORKLOG.md` changed; `.env` git-ignored; seed unchanged; `npm run lab 01` red (15 failed), as it should be                                                     |
| `02-users.md`      | users resource (nest-cli → template → 14 markers); verify unit 30 / e2e 24; broke each rule once and saw red; stopped                                                                                           | only `src/users/`, `test/users…`, `app.module.ts`, `WORKLOG.md`; no notes resource, no MCP server; seed unchanged                                                    |
| `03-notes.md`      | notes + sharing; verify unit 46 / e2e 60; lab 01 15/15; broke each rule once; stopped                                                                                                                           | only `src/notes/`, `test/notes…`, `app.module.ts`, `WORKLOG.md`; **no MCP server, no `mcp` script, lab 02 still red** (the module 1 checkpoint)                      |
| `04-mcp-server.md` | MCP server, 11 tools with read/write annotations, SQL guards; verify unit 73 / e2e 89; labs 31/31; switched off each SQL guard once and saw red; the Claude Desktop entry, one question and one change; stopped | only the MCP files, its tests, the `mcp` script, `WORKLOG.md`; verify exit 0 (73 / 89) and labs 31/31 re-run by the proctor; seed unchanged; no process left running |

Every step stopped at its own scope and wrote its WORKLOG entry.

## Found, and what changed

- **`dueAt` without an offset** (`2026-11-01T09:00:00`): this agent and an earlier one both
  stopped to ask, because `specs/notes.md` said only "any offset accepted". Both chose 400,
  as does the module 1 checkpoint. The spec now says an offset is required and why.
- **Step 01 did not run `npm run lab 01`.** The slide's "Watch its approach" expects a red lab
  01; this agent proved the base with `verify` alone. Not a defect (step 01 does not ask for
  the lab), but say it aloud: the lab is red on the base on purpose.
- The agent's own observations, not acted on: `npm install` skips the install scripts of
  esbuild and `@scarf/scarf` (nothing needs them); `update-note` marked destructive because
  it overwrites data (the spec does not require it either way).
