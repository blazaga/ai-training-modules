# Checkpoints: catching up after a module

Each module ends at a checkpoint: the state the lab checks expect. Your agent will not build
exactly this code, and it does not need to. The checkpoints exist for one case: **your agent went
somewhere you cannot recover from in the time, and the next module is starting.**

| patch                            | after    | adds                                                                                  |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `module-1-orders.patch`          | module 1 | `specs/orders.md`, `src/orders/` (generated and filled), unit + e2e tests             |
| `module-2-phone.patch`           | module 2 | `users.phone` in the schema and table, migration `0001`, tests for E.164 and `null`   |
| `module-3-auth-devices.patch`    | module 3 | `src/auth/` (Passport Basic login, then JWT), `src/devices/`, migration `0002`, tests |
| `module-4-mcp-stdio.patch`       | module 4 | `src/mcp/` notes tools + `publish-note`, the stdio entrypoint, its e2e test           |
| `module-5-mcp-http.patch`        | module 5 | `attach-mcp.ts`: the same tools at `/mcp`, `MCP_ALLOWED_HOSTS`                        |
| `module-6-mcp-device-auth.patch` | module 6 | the device-key middleware on `/mcp`, the `whoami` tool                                |
| `stretch-expires-at.patch`       | stretch  | `expiresAt` on device secrets, migration `0003` (lab 12)                              |
| `capstone-notes-ownership.patch` | homework | device-scoped notes through REST and MCP, `my-notes` (lab 10)                         |

The branch `modules-done` of the course repository has a second complete build: the six
modules as an AI agent built them from the proctor's instructions, one commit per module.
Use it to compare approaches, not to catch up: its code differs from these patches.

## Catch up to module N

Never patch on top of your own work: the patches expect the exact checkpoint before them. Take a
**fresh copy of the base** instead, and keep your own folder to compare against.

```bash
# from the course repository root; the copy must be OUTSIDE this git repository
CP="$PWD/docs/ai-agent-training/checkpoints"
cp -r boilerplate/nest-ai-starter ~/catch-up
cd ~/catch-up
rm -rf node_modules dist data .env    # if they came along
git apply "$CP/module-1-orders.patch"
git apply "$CP/module-2-phone.patch"
# … up to module N, in order
pnpm install && cp .env.example .env
pnpm build && pnpm db:migrate         # migrate runs from dist/, so build first
pnpm verify                           # read the counts against the table below
pnpm lab 01 02 03 04                  # the labs up to module N (here 3) are green
```

⚠️ Inside this course repository, `git apply` resolves paths from the repository root, so run in
the starter folder it prints `Skipped patch …` for every file and **still exits 0**: nothing
changes. That is why the copy goes outside. If you must apply in place, run from the repository
root with `--directory=boilerplate/nest-ai-starter`, and confirm with `git status` that files
really changed.

A bare `pnpm lab` runs every lab, so it exits 1 at every checkpoint: the later labs (and, at
module 6, the stretch and capstone) are red by design
(measured at module 3: `Test Files  5 failed | 4 passed (9)`). Name the labs up to your module
instead; the table below lists them.

The stretch and capstone patches apply on top of module 6, alone or together (they touch
different files).

## What each checkpoint was checked against

Every checkpoint was exported clean, installed, migrated and run through `pnpm verify` and every
lab check. A copy of the base with patches 1–6 applied is byte-identical to checkpoint 6.

| checkpoint   | `verify`: unit | `verify`: e2e | lab checks green                          | lint warnings |
| ------------ | -------------- | ------------- | ----------------------------------------- | ------------- |
| base         | 40             | 26            | none                                      | 0             |
| module 1     | 47             | 42            | 01                                        | 0             |
| module 2     | 49             | 50            | 01, 02                                    | 0             |
| module 3     | 66             | 72            | 01, 02, 03, 04                            | 0             |
| module 4     | 66             | 82            | 01, 02, 03, 04, 06                        | 0             |
| module 5     | 67             | 86            | 01, 02, 03, 04, 06, 08                    | 0             |
| module 6     | 67             | 89            | 01, 02, 03, 04, 06, 08, 09                | 0             |
| 6 + stretch  | 69             | 94            | module 6's + 12                           | 0             |
| 6 + capstone | 70             | 97            | module 6's + 10 (lab 06 runs over `/mcp`) | 0             |

Labs 10 and 12 stay red at module 6 by design: they are the capstone and the stretch.

## Discussion points the checkpoints raise

- **Module 1:** deleting rule O2 (service) turns exactly one unit test red. Deleting O1 (schema)
  turns no unit test red, because unit tests receive already-parsed input; only e2e and the lab
  check see it. The contract is silent on reopening a fulfilled order; the checkpoint records that
  as an open question in the spec instead of inventing a rule. Did your agent?
- **Module 2:** the generated SQL is a nullable ``ALTER TABLE `users` ADD `phone` text``, safe on
  a populated table. Ask your agent why, and check its answer against the SQL.
- **Module 3:** every failure is one 401 body. `passport-http` on its own answers a malformed
  Basic header with 400; the guard's `handleRequest` is what makes it 401.
- **Module 4:** `publish-note` calls `NotesService.update`, so the "published needs a body" rule
  is enforced once, in the service; the tool adds no rule of its own.
- **Stretch:** the expiry rule lives in `DevicesService.verifyDeviceKey`, so `/mcp` returns the
  same 401 as every other failure. SQLite stores timestamps as the exact text it is given, so the
  input schema normalizes any offset (`+08:00`) with `toISOString()`: without that, the e2e test
  with an offset gets a 500.
- **Capstone:** ownership is enforced in the service (another user's note is "not found"); over
  stdio, where there is no device identity, the notes tools fail closed with a tool error.
