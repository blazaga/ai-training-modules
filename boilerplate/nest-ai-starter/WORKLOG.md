# WORKLOG — nest-ai-starter

Newest first. Stamps from a clock, with offset.

## 2026-10-27T15:01:53+08:00 - CLAUDE.md: a guided run stops after each instruction

- **Why:** in the workshop every learner's agent must stop when its instruction is done, so
  the room moves one step at a time; the repo shows later specs and red later labs from the
  start, which invite an agent to carry on.
- **What:** new section "Guided run: one instruction at a time". Measured with fresh agents
  on Instructions 1 and 2: both stopped at their own scope; the second, after the WORKLOG
  clarification, also wrote its entry. No code changed.

## 2026-10-27T14:37:06+08:00 - No .env falls back to the seeded file; a taken port says so

- **Found by the dry run of "Check it: module 1":** (1) without `.env` the app ran on an empty
  in-memory database, so the playground showed none of the seeded rows; (2) on a taken port
  `npm start` printed "successfully started" and then a stack trace, which reads like a
  running app.
- **Fix:** `env.schema.ts` defaults an unset `DATABASE_URL` to `file:./data/app.db` when
  `NODE_ENV=development` (test keeps in-memory; production still requires it), with a unit
  test for each side. `main.ts` catches `EADDRINUSE`, logs `port N is already in use: set
another one in .env (PORT=3100) and use it in the URL`, and exits 1.
- **Measured:** no `.env`, `node dist/main.js` → `driver: sqlite (file)`; a second start on the
  same port → that line, exit 1. `npm run verify` exit 0, unit 21 (was 20), e2e 5; both
  checkpoint patches still apply; `data/app.db` unchanged.

## 2026-10-27T13:59:22+08:00 - README quick start: tests first, playground instead of curl

- **Request (operator):** no curl on Windows; tests before the playground.
- **What:** the README's PowerShell block runs `npm run verify` and `npm run lab 01` first,
  then builds, starts and opens `/playground`. No code changed.

## 2026-10-27T12:44:57+08:00 - The MCP server writes as well as reads: create-user, delete-note, execute

- **Request (operator):** the SQL MCP needs read and write tools, so a learner can query and
  insert from Claude Desktop on their own machine.
- **Spec (`specs/mcp.md`):** read tools unchanged; write tools are now `create-user`
  (unique, lower-cased email: `CONFLICT`), `create-note`, `update-note`, `delete-note` (shares
  cascade), `share-note`, `unshare-note`, and `execute`: one SQL `INSERT`, `UPDATE` or
  `DELETE` → `{ rowsAffected }`, refused with `NOT_ALLOWED` for DDL, `PRAGMA`, `SELECT`,
  several statements and an `UPDATE`/`DELETE` without `WHERE`; foreign keys on
  (`CONSTRAINT`). Every tool annotated `readOnlyHint` / `destructiveHint`. The Claude Desktop
  section asks for a change as well as a question.
- **Lab 02:** 16 checks (was 10). Against the previous module 2 build the 9 unchanged checks
  passed and the 7 new ones failed. Each of the 5 SQL guards, removed one at a time from the
  new build, turns lab 02 red; the first version missed two (a write hidden in `WITH` sent to
  `query`, and the statement-type check, masked because every refused statement also lacked
  a `WHERE`), so three cases were added.
- **Measured:** a fresh agent rebuilt module 2 from the module 1 checkpoint with only the
  learner's instruction: `npm run verify` unit 46, e2e 58; labs 31/31; `data/app.db`
  unchanged. The base + both patches after `npm ci` reproduce those counts.

## 2026-10-27T12:27:12+08:00 - npm instead of pnpm

- **Request (operator):** use npm, the package manager that ships with Node, so newer learners
  have nothing extra to install.
- **What:** `pnpm-lock.yaml` and `pnpm-workspace.yaml` removed, `packageManager` dropped from
  `package.json`, `package-lock.json` committed (469 packages, all from registry.npmjs.org),
  `scarfSettings.enabled: false` keeps Swagger UI's telemetry off. Every command in the docs,
  skills, scripts and messages now reads `npm run <name>`, `npx nest`, and
  `npm run resource:template -- --name …`.
- **Measured:** npm drops a script flag given without `--` (`--name user` was eaten with an
  "Unknown cli config" warning), so the template command carries `--`; a positional
  (`npm run lab 01`) is forwarded as is. After a fresh `npm install`: `npm run verify` exit 0
  (unit `Tests 20 passed`, e2e `Tests 5 passed`, 0 markers, migrations clean); `npm run lab 01`
  exit 1 with 15 failed (expected on the base); `npm run db:seed` byte-identical; in a scratch
  copy `npx nest g resource users` and the template command exit 0 (12 files, 14 markers).
- **Also:** an old entry below named the internal service the devices spec was modelled on;
  reworded.

## 2026-10-27T12:06:35+08:00 - A playground page replaces Postman in the labs

- **Request (operator):** remove Postman from the labs; serve a page in the Nest app that lists
  the requests, so a learner clicks one and sees the controller's answer. Keep the Postman
  collection in the repo only.
- **What:** `GET /playground` (mounted in `configure-app.ts` with the API docs, so it needs no
  change to `AppModule` and every checkpoint has it), built from `src/playground/requests.ts`:
  the 19 module 1 requests, each with Send, the status with a ✓ when it is the expected one,
  the time and the body; **Run all in order** carries the new ids along; variables editable.
  One self-contained page, no new dependency. `test/playground.e2e-spec.ts` (3 tests).
- **Measured in a real browser** (Playwright Chromium in a sibling container on this
  container's network): on the module 1 + 2 build, Run all → 19 of 19 ✓, all four ids set, 0
  page errors; on the base → health ✓, 4 × 404, 14 waiting for an id, 0 page errors. The first
  run found a gap (a request skipped for a missing id never got a state); fixed before commit.

## 2026-10-27T11:54:21+08:00 - Windows: the checks start their tools with node, not the .bin shims

- **Request (operator):** expect the audience on Windows.
- **Bug fixed:** four places ran `node_modules/.bin/<tool>` with `execFile`/`spawnSync`:
  `test/global-setup.ts` and `test/labs/lab-harness.ts` (`nest build`),
  `scripts/apply-resource-template.mjs` (prettier), `scripts/check-migrations.mjs`
  (drizzle-kit). Those shims are shell scripts here (`#!/bin/sh`) and `.cmd` files on Windows,
  which a program cannot start that way, so `pnpm verify` and the labs would have failed on
  every Windows machine. Each now runs `process.execPath` with the tool's own JS entry
  (`@nestjs/cli/bin/nest.js`, `prettier/bin/prettier.cjs`, `drizzle-kit/bin.cjs`).
- **Measured on Linux** (no Windows machine here): `pnpm verify` exit 0 on the base (20 / 2);
  the template still formats (prettier check clean, provided table kept, 14 markers);
  `check-migrations` still catches drift (an added column: exit 1, `DRIFT`). libSQL parses
  `file:C:/Users/…/app.db` as the path `C:/Users/…/app.db`, so the Claude Desktop helper's URL
  form holds on Windows. `.gitattributes` already pins LF, so prettier does not fail on CRLF.
- **Docs:** PowerShell commands, one per line (Windows PowerShell 5.1 has no `&&`), `curl.exe`,
  `Copy-Item`, Claude Desktop's Windows config path and tray quit first.

## 2026-10-27T11:50:18+08:00 - Claude Desktop is the client: a helper prints its config entry

- **Request (operator):** the end goal is the learners' **Claude Desktop** app connecting to
  the MCP server they built, to query the SQLite file.
- **Why a helper:** Claude Desktop starts the server from its own working folder with a minimal
  `PATH`, so a bare `node` or a relative path breaks. `scripts/claude-desktop-config.mjs`
  prints the config file location (macOS, Windows) and the `notes-db` entry with absolute paths
  for node (the one running the script), `dist/mcp-server.js` and `DATABASE_URL`. It only prints;
  it warns and exits 1 when the server is not built or the database is missing.
- **Measured** on the module 2 build, without Claude Desktop (none in this environment): the
  printed entry, started from `/` with only its own command, arguments and environment,
  answered `initialize` as `notes-db`, listed `users 25, notes 200, note_shares 120`, and ran a
  read-only query (`done 85, open 115`); `data/app.db` unchanged. On the base: exit 1, one
  warning. The config path, Settings → Developer → Edit Config and the log folders are Claude
  Desktop's documented ones, not measured here.

## 2026-10-27T11:03:06+08:00 - Two modules, no auth: users and notes on a seeded SQLite file, then MCP

- **Request (operator):** drop auth; module 1 builds two MVCs, users and notes; module 2 an
  MCP server that reads and writes the SQLite database directly; data generated in advance
  with faker and committed.
- **The base now:** setup, health, the database layer, the templates and skills, and three
  **provided** tables (`users`; `notes` with an owner; `note_shares`, many users per note) in
  migration `0000`. `data/app.db` is committed and seeded by `scripts/seed.mjs`
  (`pnpm db:seed`): 25 users, 200 notes (115 open, 85 done), 120 shares, every email at
  `example.com`; two runs write byte-identical files. The template script keeps a provided
  table. **Entries below this one describe earlier course stages; their counts are not this
  base's.**
- **Measured on the base:** `pnpm verify` exit 0, unit 20, e2e 2; `pnpm lab` red (both labs),
  as designed.
- **Fixed after a dry run of module 1** (a fresh agent, instructions only): `db:generate`
  advice is no longer given for a provided table; the scaffold skill gains three traps (a
  provided table; zod 4 running a transform after a failed format check, which answered 500
  for a bad `dueAt`; routes beyond CRUD live outside the markers); notes R2 now says
  reopening and editing in one request is 422 too; the skill shows vitest's real summary
  format.
- **Fixed after a dry run of module 2:** `specs/mcp.md` now says the default database path is
  relative to the working directory and the server must exit 1 when the file is missing (the
  connect code would otherwise create an empty database: measured by the agent); `rowCount`
  is the number of rows returned; unexpected errors reach the client as untyped tool errors
  (the SDK catches them), so no named case may throw; the client command uses absolute paths.

## 2026-10-27T10:30:38+08:00 - Lab helper works in auth step 1; MCP spec says what to pass

- **Found by:** a chained dry run, one agent per module in one project, each building on the
  last. After auth step 1 (Basic on every route) labs 01 and 02 went red although the agent
  was right: `login()` returned no credentials until a login route existed (step 2).
- **Changed:** `test/labs/lab-harness.ts`: `login()` returns Basic credentials when there
  is no login route (ignored before auth, needed in step 1), and `hasAuth()` asks a
  protected route instead of the login route. `specs/mcp.md`: the stdio entrypoint boots
  only what the tools need (booting `AppModule` puts the global JWT guard on tool calls,
  which refuses every one: measured), and all three transport settings are passed
  explicitly (the library's defaults differ).
- **Measured:** a step-1 state (Basic as the global guard, no login route), labs 01 + 02,
  only the helper changed: old `2 failed` / 15 failed, 11 passed; new `2 passed` / 26 passed.
  Every checkpoint re-proved after the change (same counts as before).

## 2026-10-27T09:49:38+08:00 - Fixes from a learner-agent dry run

- **Why:** six fresh agents built the six modules from goal-level instructions only. All got
  their lab and `pnpm verify` green; their reports named where this project misled them.
- **Changed:** `CLAUDE.md` no longer describes the `/mcp` device middleware before it exists,
  and gains "Adding a field to an existing resource". `specs/mcp.md`: the
  `MCP_ALLOWED_HOSTS` default is the library's `'localhost'` shorthand (a literal
  `['localhost']` refuses `Host: 127.0.0.1`, measured: lab 08 fails 1 of 4); how a tool reads
  the request (`McpContext.getRawRequest()`); `whoami` over stdio is `RULE_VIOLATION`; a
  disabled user's devices keep working until archived (a stated limit). Lab contracts:
  orders storage is in memory; an explicit `null` phone clears it. Template comment and
  README pointer corrected.

## 2026-10-27T09:19:47+08:00 - The starter is the module 0 base; the agent builds the rest

- **Request (operator):** learners' AI agents build the service module by module from the
  proctor's prompts.
- **Changed:** the base has no `src/auth`, `src/devices`, `src/mcp`, `mcp-stdio.ts` or
  `attach-mcp.ts`, no migration after `0000`, no JWT/MCP settings and no auth markers in
  the template: the agent builds all of them in modules 3–6. `specs/auth.md` and `specs/mcp.md` describe what the agent builds
  (module 3; modules 4–6). Lab checks: all build labs; new `04-devices` (HTTP contract), the
  `expiresAt` lab is now `12-expires-at`; the harness adapts to what exists (`login()`
  before auth, `hasMcpHttp`, stdio client), so lab 06 runs over stdio in module 4 and over
  `/mcp` with a device from module 5 on. Lab 08 also checks that the tools are served over
  HTTP: without `McpToolsModule` in `AppModule` the list was empty, and the check caught
  it. The build plan in `plans/` is removed (it described how the course was made, with a
  database and an auth design the starter no longer has).
- **Measured on the base:** `pnpm verify` exit 0, unit 40, e2e 26, 0 lint warnings; every
  lab red; `pnpm db:migrate` prints `ledger rows: 1`. Per-module figures are in
  `docs/ai-agent-training/checkpoints/README.md`.

## 2026-10-27T08:22:29+08:00 - Auth: Passport Basic for login, then JWT; devices provisioned with X-Device headers

- **Request (operator):** no hand-rolled Basic auth; use Passport, Basic first, then JWT as
  the better handler. Devices are provisioned with one call that returns a key and secret,
  sent as `X-Device-Key` / `X-Device-Secret` to secure the HTTP MCP server.
- **Auth:** `passport-http` BasicStrategy guards `POST /api/v1/auth/login` only
  (`BasicLoginGuard`) and returns `{ accessToken, tokenType: 'Bearer', expiresIn }`.
  `passport-jwt` + global `JwtAuthGuard` (APP_GUARD) for everything else; `@Public()` opts
  out. `JwtStrategy.validate` re-reads the user, so a disabled user's token stops working.
  `JWT_SECRET` (min 32, required in production; random per process otherwise, with a
  warning) and `JWT_EXPIRES_IN` (seconds, default 3600). Removed: `passport-custom`, the
  hand-written Basic parser and its spec, `BasicAuthGuard`.
- **Devices:** `POST /devices/provision` (active device + `deviceKey` + one-time `secret`),
  `POST /devices/:id/rotate`, `DELETE` = archive (soft). Removed: plain create, issue
  credentials, activate, archive, and the `draft` status. `accessKeyId` → `deviceKey`
  (`DK` + 16 base32); column `access_key_id` → `device_key` edited into migrations 0001/0002
  and their snapshots (first edition, nothing deployed); `check:migrations` confirms they
  match the tables. MCP middleware reads `X-Device-Key` / `X-Device-Secret`.
- **Tests:** `test/support/auth.ts` (`signUpAndLogin`, `login`, `basic`); e2e suites and the
  resource template use it. Lab harness logs in; labs 03 (login + token 401s), 04 (expiresAt
  on provision/rotate), 09 (archived refused; a user token refused on /mcp) rewritten.
- **Fixed on the way:** lab 02 sent Basic to a token-only route (caught when proving its
  solution); the solution patches 01/02/04/10 regenerated (02's snapshot carried the old
  column; 10's tests used the old device flow; 10 also had the `no-misused-spread` warning).
- **Measured:** verify exit 0, unit 58, e2e 61; labs on the starter 41 failed / 17 passed
  (build labs red, guard labs 03/08/09 green: 8/3/4). Mutants: JWT `validate()` ignoring
  status → 1 e2e red; the guard leaking the failure reason → lab 03 3 red, e2e 1 red; device
  mutants (rotation keeping the hash, archived accepted, compare always true, owner check
  gone) all caught; MCP auth unregistered / after mount → 2 red each. Live on :3100:
  helper exports `DEVICE_KEY`/`DEVICE_SECRET`/`AUTH`, `/me` with `$AUTH` 200, Inspector CLI
  whoami exit 0; Postman 23 requests / 27 assertions 0 failed, folder 09 alone fails.

## 2026-10-27T07:28:36+08:00 - Fixes from a learner dry run

- `scripts/demo-device.mjs`: base URL from argv, `APP_URL`, else `PORT` (environment or
  `.env`), else 3000. Before, with the app on another port, it posted its sign-up to whatever
  answered on 3000 (measured by the dry run: HTTP 404 from another service).
- `scripts/apply-resource-template.mjs`: the "Run step 1 first" message prints the full
  `pnpm exec nest g resource <plural> --type rest --crud`.
- `src/devices/devices.service.ts`: `toStored` takes the parsed payload type, not the DTO
  class; oxlint's `no-misused-spread` warning printed on every verify. Now silent.
- `nest-resource-scaffold` skill: rows for `server-fields` and `remove-rules` (both are
  real markers); traps for `it.each` with supertest (TS2322) and a defaulted new field
  breaking older specs (TS2345).
- Lab checks: README says each check starts its own copy of the app; lab 09 test name reads
  "a device in state %s"; the capstone contract names the stdio case as a decision.
- Postman 09: "whoami with the OLD secret" first asserts that a rotation ran. Run alone it now
  fails (measured); before, it passed with no device at all.
- Verified: verify 69/61, lab split 41/16 unchanged, collection 24 requests / 28 assertions,
  0 failed.

## 2026-10-26T16:48:15+08:00 - SQLite through libSQL; no Docker, Node 24 + pnpm only

- **Request (operator):** use SQLite, then run without Docker at all (compose, Dockerfile and
  Redis removed).
- **Changed:**
  - Database: `@libsql/client` 0.18.0 + `drizzle-orm/libsql`. `DATABASE_URL` is a `file:` URL
    (`.env.example`: `file:./data/app.db`); unset means in memory, migrated on connect. A
    file database is migrated only by `pnpm db:migrate`, which reads `.env`
    (`node --env-file-if-exists`). `connectSqlite` creates the file's folder.
  - Tables: ids are TEXT UUIDs, timestamps TEXT ISO strings (`src/database/columns.ts`).
  - Migrations regenerated for SQLite. `0002` hand-edited: `DELETE FROM devices`, then the
    NOT NULL column with `ON DELETE restrict` written out.
  - Repository adapter: unique violation `SQLITE_CONSTRAINT_UNIQUE`; a blocked delete is
    `SQLITE_CONSTRAINT_TRIGGER` (RESTRICT) or `SQLITE_CONSTRAINT_FOREIGNKEY` (NO ACTION).
  - Removed: `docker-compose.yml`, `Dockerfile`, `.dockerignore`, `pg`, `pglite`.
  - Tests ignore `.env`: `ignoreEnvFile` when `NODE_ENV=test` (app and stdio entry), and the
    e2e and lab vitest configs pin `NODE_ENV=test`.
- **Root cause of that last fix (measured):** with a learner's `.env` present, the e2e suites
  booted the app on `data/app.db`, the running app's file. Result: `SQLITE_BUSY: database is
locked`, 409s on sign-ups, `Tests 1 failed | 27 passed | 33 skipped`. The Docker toolbox
  had no `.env`, so this never showed there. After the fix, with the app running on the same
  file: verify exit 0, unit 69, e2e 61; `pnpm lab` 41 failed / 16 passed, as on a stopped app.
- **Corrected:** an orphaned doc comment for `DATABASE_URL` sat above `MCP_ALLOWED_HOSTS`;
  the `MCP_ALLOWED_HOSTS` comment said "localhost only", while `127.0.0.1` also passes.
- **Measured natively** (clean copy, Node 24.22.0, pnpm 12.15.0, port 3100 because 3000 is
  taken on this host): install, build, `db:migrate` ledger 3 (twice, idempotent); restart
  keeps data (same sign-up 409); unmigrated file → 500, log `no such table: users`; wipe +
  migrate → 201; `start:dev` printed `File change detected` and restarted; the demo helper's
  `eval` set the credentials and MCP `whoami` answered 200; Host check: localhost and
  127.0.0.1 200, the hostname 403, 200 with `MCP_ALLOWED_HOSTS=localhost,<hostname>`.
  Inspector UI natively: connected and ran `whoami` (Playwright). Newman: 24 requests, 27
  assertions, 0 failed. Mutation: removing the TRIGGER branch fails the e2e test "a user who
  still owns a device cannot be deleted (409)".
- **Postman:** folder `00 · Stack` renamed `00 · Setup`; the collection description's first
  step is `pnpm build && pnpm db:migrate && pnpm start`.

## 2026-10-26T09:37:06+08:00 - MCP Inspector web UI as a compose service

- **Added:** service `inspector` (profile `inspector`, image `node:24-bookworm-slim`, Inspector
  2.12.0 `--web`). Published on `127.0.0.1:6274` (UI) and `:6275` (sandbox) only.
  - `HOST=0.0.0.0` with `DANGEROUSLY_BIND_ALL_INTERFACES=true`: 2.12.0 refuses an all-interfaces
    bind without that flag, and its own message names "inside an isolated container" as the
    case for it. The host-side loopback publish keeps it off the network.
  - `MCP_INSPECTOR_SECRET_STORE=memory`: there is no OS keychain in a container; the
    Inspector warned and fell back, now it is explicit.
  - `MCP_AUTO_OPEN_ENABLED=false`.
- **Measured with a real browser** (Playwright in a container sharing the inspector's network,
  so it reached `localhost:6274` as a laptop browser does):
  - Add Servers → + Add manually (`streamable-http`, `http://app:3000/mcp`) → Settings →
    Custom Headers (`X-Access-Key-Id`, `X-Secret-Key`) → switch on: **Connected**.
  - Tools listed 4; `whoami` → **Execute Tool** returned the device and its owner.
  - Negative control, wrong secret: **Failed**, and the Network panel shows OAuth discovery
    (`/.well-known/oauth-*`, `/register`, all 404).
- **Rejected:** presetting the server with `--server-url`. The UI then shows a READ-ONLY
  session where headers cannot be entered, and passing them with `--header` would put a
  device secret in the compose file.
- **Corrected:** chapter 07 described "List Tools" and "Run Tool"; 2.12.0 lists tools on
  connect and the button is "Execute Tool". Chapter 00 said the UI was unreachable from Docker.

## 2026-10-26T09:15:32+08:00 - Lab checks (`pnpm lab`), and three starter defects they exposed

- **Added:** `test/labs/` with one check per hands-on lab (01, 02, 03, 04, 06, 08, 09, 10), a
  shared harness and a contract sheet (`test/labs/README.md`); `vitest.config.labs.ts`; script
  `lab` (`pnpm lab 04` = one lab). The checks drive the app over HTTP and MCP only and never
  import learner code, so `tsc` passes before a lab is done. Kept out of `verify` on purpose.
- **Measured on the starter:** `Test Files 5 failed | 3 passed (8)`, `Tests 41 failed |
16 passed (57)`. The build labs (01, 02, 04, 06, 10) fail and the guard labs (03, 08, 09)
  pass, as designed.
- **Guard labs proven to fail when broken (negative controls):**
  - 08 with `enableJsonResponse: true`: 1 failed.
  - 09 with the active-status check removed: 2 failed.
  - 03: a strategy-only change had NO effect (passed), because `BasicAuthGuard.handleRequest`
    flattens every failure. Letting the strategy's error through the guard failed the 2
    expected tests, and `test:e2e` failed 2. All reverted; the lab sheet now carries that hint.
- **Build labs proven reachable:** a reference solution per build lab, each made from the
  untouched starter by following the course. Each was applied to the final starter and run
  sequentially: lab check, guards and `verify` all green (counts in
  `docs/ai-agent-training/solutions/README.md`).
- **Starter defects found by those solutions, fixed here:**
  1. `createZodDto` crashed swagger on any `.nullable()` field ("A circular dependency has
     been detected (property key: …)"), so lab 02 as written could not start. Nullable
     `anyOf` is now collapsed to `type + nullable: true`; `zod-dto.spec.ts` pins it (2 tests).
  2. `connect.spec.ts` took 4.4 s against vitest's 5 s default even when run alone, and the
     stdio e2e took 3-7 s under load: four of five solution runs failed `verify` on timeouts.
     `testTimeout` is now 20 s for unit and 30 s / hooks 60 s for e2e and labs.
  3. Template output said "a order": now "one **name**".
- **Verify after the fixes:** exit 0, unit `Test Files 14 passed (14)`, `Tests 69 passed (69)`;
  e2e `Test Files 7 passed (7)`, `Tests 61 passed (61)`.
- **Slip:** `git apply` run inside this sub-folder printed `Skipped patch` for every file and
  exited 0; caught by content (`grep -c collapseNullable` = 0), re-applied with `--directory`.

## 2026-10-26T08:48:01+08:00 - README and collection wording: first edition

- Removed the newman verification paragraph and "so nobody has to type curl" from the README's
  Postman section, and "so you do not need curl" from the collection description, on the
  operator's instruction that the course text carry no creation or replacement traces.
  Collection requests, tests, variables and auth are identical to the verified version
  (compared field by field), so the newman results still apply; they are recorded in the
  entry below.

## 2026-10-26T07:20:30+08:00 - Postman collection for the labs

- **Added:** `postman/nest-ai-starter.postman_collection.json` (v2.1): 7 folders,
  24 requests, numbered by chapter, each named with its lite module. Collection-level Basic
  auth; requests that must not send credentials override it with No Auth. Every request
  carries tests. Issued device credentials are stored in collection variables for the MCP
  folders, so the collection description warns never to export or share it after a run.
- **Why:** the operator wanted the audience off curl for every controller call.
- **Measured** (newman 6 in a container on the compose network, `baseUrl=http://app:3000`):
  - fresh database: 24 requests, 28 assertions, 0 failed;
  - re-run: 27 assertions, 0 failed, `NEWMAN_EXIT=0` (sign-up takes its 409 path);
  - negative control, wrong password: 17 assertions failed, `NEWMAN_EXIT=1`. So the tests
    can fail.
  - Also measured: a stateless `tools/list` with no prior `initialize` answers; a
    `create-note` that breaks the published-body rule comes back as `isError`, not a
    JSON-RPC error; postman-runtime sends a custom `Host` as written (403).
- **Slip, mine:** the first newman run read the collection from a directory that did not
  exist in the container. My `2>/dev/null` hid the `docker cp` error, and the reported
  "exit 0" was grep's. Re-run with newman's own exit code.

## 2026-10-25T22:36:50+08:00 - scripts/demo-device.mjs (lab helper)

- **Added:** a script that, on a running app, signs up or reuses `demo@example.com`
  (201 or 409 accepted), creates a device, issues credentials, activates it, and prints
  `export DEVICE_ID / MCP_KEY_ID / MCP_SECRET / DEMO_BASIC`. Base URL: argv, then
  `APP_URL`, then `http://app:3000`. Any other HTTP status exits 1 with the step name.
- **Why:** labs 04, 05 and 09 each needed four REST calls before the interesting part.
- **Measured:** with `--build`, the compose build log reached the same stdout, and a bare
  `eval` ran those lines as shell commands. The documented form filters with
  `grep '^export '`; tested with `--build`: no stray output, all four variables set.
- **Found late (2026-10-25T22:40+08:00), from `git status`:** that bare `eval` did more than
  print noise. Build-log lines like ` ---> Running in <id>` ran as shell commands, and
  their `>` CREATED 13 empty files in this directory (`Running`, `Removed`, `Using`, and
  ten named after image ids), all at 13:59:24Z. Deleted. So the `grep` filter is a safety
  requirement, not tidiness: unfiltered, the build log writes to your working tree.

## 2026-10-25T21:31:00+08:00 - CORRECTION: leftover anonymous volume from the real-Postgres check

- **Found by the coordinator, not by me:** anonymous volume `04a7f102c0a3…`, created
  2026-10-25T21:01:05+08:00, used by no container. My production-path entry had
  claimed "0 volumes"; that claim is withdrawn in place.
- **Proven mine by its contents, not its timing:** a Postgres 17 data directory
  containing my test data (`pg agent`, `bo@example.com`, `cy@example.com`), read with a
  read-only mount using an image already on the host.
- **Mechanism:** the postgres image declares `VOLUME /var/lib/postgresql/data`. I started
  `edu-nas-db` with `--rm` and then FORCE-removed it with `docker rm -f`, which does NOT
  remove anonymous volumes (`--rm` cleans up only when a container exits by itself). My
  check counted volumes by NAME (`-f name=edu-nas-scripts`), so it could never see an
  anonymous one: the instrument was structurally blind to the residue it was meant to
  find.
- **Removed and verified:** the volume is gone, and 0 anonymous volumes created since
  19:29+08:00 remain. The ch00 compose test is not affected: `docker compose down -v`
  removes anonymous volumes, and that check filtered by project label.
- **Rule for next time:** check anonymous volumes by creation time in the session window
  (`docker volume ls --filter label=com.docker.volume.anonymous`), and remove containers
  with `docker rm -fv`.

## 2026-10-25T21:29:24+08:00 - scanner: key-assign narrowing WITHDRAWN (coordinator review of 8c050ae8c)

- **Withdrawn:** the ch04a change that made `key-assign` require a digit in the value (see
  "Scanner precision change" in the ch04a entry). Its own trade-off note said
  digit-free secrets would pass; the coordinator rejected it on exactly that ground.
- **Now:** the original rule (12+ char value, quoted or not), excluding only FUNCTION
  CALLS. The value is matched possessively (`{12,}+`, PCRE). Measured: without the
  possessive quantifier the rule backtracks and matches `secret: generateSecre`; with it,
  0 matches.
- **Controls:** a planted file gives exit 1 with 4 hits: the digit-free
  `abcdefghijklmnopqrstu` and `correcthorsebatterystaple` plus the two digit-bearing
  ones. Both call lines (`generateSecret()`, `makeTheTokenNow ( )`) are skipped.
- **What the narrowing had hidden:** the restored rule found 2 lines written after the
  narrowing, `password: ownerPassword` (a variable reference) and
  `SECRET_KEY_HEADER = 'x-secret-key'` (a header name). Neither is a secret; each got a
  reviewed, file-scoped exception. Real tree: key-assign 0 (+9 reviewed exceptions);
  scan exit 0.

## 2026-10-25T21:27:10+08:00 - Docker-first: compose stack + dev toolbox

- **Request (operator):** everything runs in Docker; include the supporting infra.
  Operator decision: Redis is **infrastructure only** (not used by the app yet).
- **Changed:** `docker-compose.yml` with `db` (Postgres 17), `redis` (Redis 8), `migrate`
  (one-shot, gates the app via `service_completed_successfully`), `app`, and `dev`
  (toolbox, profile `dev`, source bind-mounted, deps in a volume). The Dockerfile gained
  `base` / `dev` stages and runs as `node`; `runtime` stays the default target.
  `MCP_ALLOWED_HOSTS=localhost,app`.
- **Measured** (compose project with a test-only override that removes published ports
  and the dev bind mount; that override is not committed):
  - order: db/redis healthy → migrate `ledger rows: 3`, exit 0 → app healthy; redis
    `PONG`;
  - toolbox `pnpm verify` exit 0, unit `Tests 67 passed`, e2e `Tests 61 passed`, user
    `node`, Node v24.22.1, pnpm 12.15.0;
  - toolbox → app by service name: REST device setup, then Inspector CLI `whoami` →
    `toolbox agent active owner ada@example.com`, with 0 secret occurrences in the log;
  - `down` + `up` keeps the data (users 1 → 1); `down -v --rmi local` leaves 0 containers,
    volumes, networks and images; the pulled base images were removed too.
- **NOT measured here:** the dev bind mount (this environment cannot mount host paths)
  and the Inspector web UI in a container. Both are stated in chapter 00.
- **Instrument slips:** `docker manifest inspect` reported a tag I had already pulled as
  missing (it was timing out), so I replaced it with real pulls. Then `pkill -f` matched
  my own shell (exit 144). The verify grep missed colour-coded lines in container
  output, and the counts were read after stripping ANSI codes.

## 2026-10-25T21:03:39+08:00 - production path verified on REAL Postgres (Docker)

- **Why:** every test runs on PGlite, so node-postgres, `db:migrate` and production mode
  had never been exercised.
- **Measured:** postgres:17 plus the app image on a private Docker network.
  - The image builds (pnpm 12, frozen lockfile, denied install scripts).
  - `node dist/database/migrate.js` inside the image: **ledger rows 3**; a second run
    still 3 (idempotent).
  - Production without `DATABASE_URL` refuses to start, naming the variable only.
  - The app is `healthy`. Inside the container: sign-up 201 → device → credentials →
    activate 200 → MCP `whoami` 200 (right device) and no creds 401; docs 404 in
    production. Postgres has 1 active device with a hash and `last_used_at`.
- **The MCP_ALLOWED_HOSTS trap, reproduced:** from another container by service name
  with VALID credentials, `/mcp` → 403 `Invalid Host: edu-nas-app`; with
  `MCP_ALLOWED_HOSTS=edu-nas-app` → 200.
- ~~**Cleanup verified:** 0 containers, 0 networks, 0 volumes, 0 app images~~ —
  **WITHDRAWN (see the entry dated 2026-10-25T21:31:00+08:00): an anonymous Postgres data volume
  was left behind.** The postgres:17-alpine image I pulled was removed.

## 2026-10-25T21:00:25+08:00 - ch09: device authentication on the MCP HTTP endpoint

- **Changed:** `deviceAuth` middleware on `/mcp`, registered in `attachMcp` BEFORE the
  transport mounts its routes. Headers `X-Access-Key-Id` + `X-Secret-Key`, checked with
  `DevicesService.verifyAccessKey` (active only, timing-safe, rotation-aware). Every
  failure is the same HTTP 401 before any JSON-RPC. The device is attached to the request;
  the `whoami` tool reads it via `McpContext.getRawRequest()`. stdio stays
  unauthenticated (local trust) and `whoami` there is a tool error.
- **Verified:** `pnpm verify` exit 0: unit `Tests 67 passed`, e2e `Tests 61 passed`. All 7
  failure modes return the SAME 401: no headers, key id only, unknown key, wrong secret,
  draft, archived, rotated-away secret. Mutations:
  - auth not registered → 2 fail;
  - status unchecked → 1 fails;
  - middleware registered only AFTER mount → 2 fail (so the ordering claim in the code
    comment is measured);
  - the ch08 "open" test failed with exactly the new 401 when it ran against ch09 code.
- **Inspector (2.12.0) with headers:** `--header "X-Access-Key-Id: …" --header
"X-Secret-Key: …"` → whoami works. WITHOUT headers the Inspector treats our 401 as an
  OAuth challenge (MCP authorization spec) and exits 3 `auth_required`. So device keys
  suit header-configured machine clients, not interactive OAuth clients; the OAuth path is
  `@rekog/mcp-nest-auth` (not built here).
- **Hygiene:** the secret was redacted from the captures (0 occurrences); no secret or
  header value appears in the server log.

## 2026-10-25T20:56:13+08:00 - ch08: stdio → Streamable HTTP (+ configuration)

- **Changed:** `attachMcp(app)` (called by main.ts AND e2e): `StreamableHttpTransport`
  with every option explicit. `MCP_ALLOWED_HOSTS` env (defaults to localhost).
  `McpToolsModule` added to AppModule.
- **Defaults read from mcp-nest 2.0.8 source:** endpoint `/mcp`; `statefulMode` false;
  `enableJsonResponse` = !statefulMode, i.e. TRUE by default, so the default config never
  streams SSE (we set false); allowed hosts/origins are localhost only.
- **Measured on the wire (built server):** `/mcp` is at the root and `/api/mcp` → 404;
  `initialize` → `content-type: text/event-stream`, `event: message` + `data: <JSON-RPC>`;
  stateless `tools/call` works without a session; a foreign Host → 403. Captures saved
  for ch05.
- **Security finding, stated in the e2e name:** the global Basic-auth APP_GUARD does NOT
  protect MCP tool calls (they are microservice handlers); `/mcp` answered tools/call with
  no credentials. ch09 closes this.
- **Instrument trap caught:** my first Host test used `fetch`, which SILENTLY replaces a
  `Host` header (an echo server saw `localhost`), so it got 200 and the server looked
  broken. Rewritten with `node:http` plus a one-variable control (localhost → 200,
  evil.example → 403).
- **Verified:** `pnpm verify` exit 0: unit `Tests 67 passed`, e2e `Tests 58 passed`.

## 2026-10-25T20:53:09+08:00 - ch07: MCP Inspector (official, pinned 2.12.0)

- **Changed:** `pnpm mcp:inspect` (web UI) and `pnpm mcp:inspect:cli` (scripted), both
  pinned to `@modelcontextprotocol/inspector@2.12.0`, against `dist/mcp-stdio.js`.
- **Captured from real runs** (kept for the course chapter, under
  `/data/claude/edu-training/captures/`): `tools/list` shows the zod-derived JSON Schema
  (minLength, enum, defaults, pattern); `tools/call create-note` returns the stored note;
  `tools/call get-note` with an unknown id returns `isError: true` and the **CLI exits 5**,
  so it can serve as a CI check. The web UI listens on 127.0.0.1:6274 and its URL carries
  an API token (redacted in the capture; the raw log was deleted).
- **Not done:** the web UI could not be viewed from this container (no browser). Only its
  startup output was verified.

## 2026-10-25T20:51:00+08:00 - ch06: first MCP controller over stdio (@rekog/mcp-nest 2.0.8)

- **Measured design of mcp-nest 2.x:** there is no `McpModule`; MCP is a NestJS
  microservice transport strategy (`McpStrategy`), tools live on `@McpController()`, and
  the transports are `StdioTransport` and `StreamableHttpTransport` only (no SSE class in
  2.0.8). Peers: MCP SDK v2 (server 2.4.0 / node 2.1.2 / core 2.4.0, all stable) and
  `@nestjs/microservices` 12.2.0. No install scripts were needed.
- **Changed:** `NotesTools` (`list-notes`, `get-note`, `create-note`) over the same
  `NotesService`; `create-note` reuses `CreateNoteSchema`. `runTool()` maps a DomainError
  to a tool error (`isError: true`). `src/mcp-stdio.ts` entrypoint (logger off).
  `test/global-setup.ts` builds fresh for e2e and FAILS on a stale `dist/`.
- **Verified with a real MCP client (SDK v2), not logs:** initialize identity; 3 tools;
  the inputSchema `required: ["title"]` comes from zod; an unknown id gives
  `isError: true` `NOT_FOUND`; invalid input is rejected with messages, including the
  cross-field rule R2. `pnpm verify` exit 0: unit `Tests 66 passed`, e2e
  `Tests 54 passed`.
- **Correction (to my own comment):** I wrote "one stray console.log corrupts the
  stream". Measured: the line DOES reach stdout, but the SDK v2 client silently skips
  plain-text lines and only reports JSON-shaped ones as protocol errors, so every
  client-driven test passed with the mutant. Comment corrected. Added a RAW-stdout test
  (every line must be JSON-RPC 2.0), and it fails on the console.log mutant.

## 2026-10-25T20:46:31+08:00 - ch04b: devices merged with users (ownership)

- **Changed:** `ownerUserId` (server-owned, FK → users, `ON DELETE RESTRICT`); every
  `DevicesService` method takes the owner and scopes through `findOne`. Another user's
  device is NOT FOUND (404) for every operation; the list is per owner. `@CurrentUser()`
  decorator. The adapter maps a blocked FK delete to 409.
- **Migration hand-edited (measured):** drizzle-kit generated `ADD COLUMN owner_user_id
uuid NOT NULL`, which FAILS on a populated table ("contains null values"). Rewritten as
  nullable → delete unattributable pre-ownership devices (assigning them would hand
  someone else's credentials to an arbitrary user) → SET NOT NULL → FK. Probed on a
  populated and a fresh database: both apply, and the column ends NOT NULL.
  check-migrations is still clean.
- **Measured SQLSTATEs:** `ON DELETE RESTRICT` → 23001, `NO ACTION` → 23503. My first
  mapping handled only 23503, and the e2e "user who owns a device cannot be deleted
  (409)" test caught it as a 500.
- **Verified:** `pnpm verify` exit 0: unit `Tests 66 passed`, e2e `Tests 47 passed`.
  Mutation: removing the owner check fails 1 unit and 1 e2e test.

## 2026-10-25T20:41:48+08:00 - ch04a: devices (standalone) with credentials

- **Changed:** `devices` through the pipeline (`--storage drizzle`, 17 markers filled from
  `specs/devices.md`, which is modelled on an existing internal service with its measured weaknesses
  corrected). Credentials: `AKID`+16 base32, `dsk*`+base64url(32 bytes), sha256 at rest,
  timing-safe compare, shown once from `POST /:id/credentials`; rotation keeps the key id
  and invalidates the old secret immediately. Plus `/activate`, `/archive`(soft delete),
  and`verifyAccessKey` (for ch09).
- **Template upgrade:** `server-fields` (returned, never accepted) and `remove-rules`;
  notes/users updated to the resolved form.
- **Adapter fix (measured):** drizzle timestamp columns throw on ISO strings
  (`value.toISOString is not a function`, drizzle-orm 0.45.4); `DrizzleRepository` now maps
  strings to Dates for `PgTimestamp` columns. It has its own spec now; the mutant without
  the mapping fails 1.
- **Verified:** `pnpm verify` exit 0: unit `Tests 64 passed`, e2e `Tests 45 passed`;
  migration `0001` adds `devices` (unique `access_key_id`); check-migrations is clean.
  Mutations: rotation keeps the old hash fails 1; non-active devices authenticate fails 2;
  match-always fails 4.
- **Slip caught:** my fill removed the template's `void current;` lines (outside the
  markers); restored, so devices differ from a fresh render only at marker regions plus
  the clearly marked "added in ch04" methods and endpoints.
- **Scanner precision change** (`tools/scan-sensitive.sh`): `key-assign` now requires a
  DIGIT in the value, because `secret = generateSecret()` was flagged 3 times. Controls:
  `api_key: 'ABCDEFGH12345678'` and `TOKEN=ghx7Kd92LmQ0pZr4` are still caught, and the
  `generateSecret()` line is not. **Trade-off:** an all-letters secret (a passphrase) is
  no longer flagged by this rule.

## 2026-10-25T20:35:27+08:00 - ch03b: Passport, secure by default

- **Changed:** the middleware is replaced by a Passport strategy `basic` (passport-custom +
  our RFC-correct `parseBasicAuth`) and a GLOBAL `BasicAuthGuard` (APP_GUARD). Every route
  is authenticated unless it is `@Public()`: health and `POST /users` (sign-up). Same 401
  body + `WWW-Authenticate` for every failure. Swagger: `.addBasicAuth()`, deliberately
  without a global requirement, so public routes are not documented as protected.
- **Templates:** an `access-create` marker (public create), an e2e `http` helper that sends
  `authHeaders` on every request, an `e2e-setup` marker (sign up + Basic), and a generic
  "no credentials → 401" test. notes and users e2e were re-rendered; their test-name sets
  differ from before ONLY by the new 401 test.
- **Why not passport-http (measured on 0.3.0):** `split(':')` then `credentials[1]`, so the
  password `correct horse: battery` arrives as `correct horse`; a bare `Basic` header fails
  with 400; it uses deprecated `new Buffer()`.
- **Verified:** `pnpm verify` exit 0: unit `Tests 44 passed`, e2e `Tests 32 passed`.
  Mutations:
  - global guard removed → 5 e2e fail;
  - health not public → 1 fails;
  - colon truncation → 3 fail;
  - sign-up not public → vitest exit 1, `Test Files 3 failed`, but the Tests line shows
    `2 passed | 30 skipped` with NO failures. Added to the nest-verify skill: read the
    Test Files line and the exit code, not only the Tests line.
- **Slip caught by tsc:** the e2e transplant dropped the `let n = 0` counter the users
  `valid()` factory needs (my extraction kept comment lines only). Restored from the backup.

## 2026-10-25T20:30:27+08:00 - ch03a: hand-written HTTP Basic auth middleware

- **Changed:** `nest g module/controller/middleware` for auth, then filled in:
  `parseBasicAuth` (RFC 7617, split at the first colon), `BasicAuthMiddleware` on
  `GET /api/v1/auth/me`, and `UsersService.verifyCredentials` (unknown emails run one
  scrypt verify against a decoy hash; disabled users fail).
- **Verified:** `pnpm verify` exit 0: unit `Tests 44 passed`, e2e `Tests 30 passed`. Every
  failure mode (no header / wrong scheme / malformed / unknown email / wrong password) gives
  ONE identical 401 body plus `WWW-Authenticate`; disabled users get the same 401.
  Mutations: middleware detached fails 3 of 4 auth e2e; disabled check removed fails 1.
- **Not verified, and not claimed:** the decoy hash equalises the WORK done for unknown
  emails. No test measures response timing, which would need a statistical test that is
  too flaky for CI.

## 2026-10-25T20:27:10+08:00 - ch02: users with drizzle + zod (course track T2)

- **Changed:** `src/database/` (DB token; Postgres if `DATABASE_URL` is set, else in-memory
  PGlite migrated on boot; production requires the URL), `DrizzleRepository` (the same
  `Repository` port; unique_violation 23505 → 409), scrypt password hashing,
  `docker-compose.yml`, `db:generate` / `db:migrate` / `check:migrations`.
- **Template upgrade** (applies to every future resource): `PRIVATE` fields + a response
  schema that strips them; a `create-mapping` step for write-only inputs; per-resource
  repository `queries`; an e2e `valid()` factory (needed by unique fields); `--storage
drizzle` overlay (table, repository, PGlite service spec, table/schema drift test, auto
  registration in `schema.ts`).
- **users** built through the pipeline: `nest g resource users --type rest --crud`, then
  `--storage drizzle`, 12 AI-FILL markers filled from `specs/users.md`. **notes** was
  re-rendered on the new template and its fills transplanted.
- **Verified:** `pnpm verify` exit 0: unit `Tests 34 passed`, e2e `Tests 26 passed`,
  check-migrations clean. Mutations: R1 (no lower-casing) fails 1 e2e; R2 (plain password
  stored) fails 1 unit; R3 (hash not private) fails tsc and 7 e2e.
  `drizzle-kit generate` works with esbuild install scripts DENIED (artefact:
  `drizzle/0000_*.sql`).
- **Measured during the build and fixed:**
  - With `.unique()` removed from the TS table and no migration, all 7 users unit tests
    still passed, because PGlite is built from the migration SQL. Hence
    `check:migrations` in `verify`.
  - The first version of that checker PASSED while drizzle-kit had crashed: an absolute
    `--out` gives ENOENT with exit 0. Rewritten to fail closed on drizzle-kit's own
    messages, with controls clean 0 / drift 1 / broken input 2.
  - My notes transplant silently dropped one e2e test (an empty slice between two
    anchors), and `verify` stayed green. It was caught by comparing the test count with
    the expected count, then restored; the old and new test-name sets now differ only by
    the new template test.
- **Correction (after commit 8233e5cbb):** I ticked T2 in the plan before its criterion
  "the ledger is read in a test" was met; no such test existed. Added
  `src/database/connect.spec.ts`: ledger rows == journal entries. Control: an unmigrated
  PGlite has no `drizzle.__drizzle_migrations` relation at all, so the test can fail.

## 2026-10-25T20:09:21+08:00 — ported to Nest 12 / latest nest-cli (operator request)

- **Why:** so learners following along get the same output as a current `nest new`. This
  supersedes "Why Nest 11" in the entry below.
- **Method:** a fresh `@nestjs/cli@12.0.10 new` scaffold, with our layer ported onto it, so
  every Nest 12 default is inherited rather than hand-copied. Measured registry state: Nest
  12.2.0, cli and schematics 12.0.10, swagger 12.0.4, config 12.0.1, zod 4.6.7.
- **What Nest 12 changed and how each was handled:**
  - **ESM** (`"type": "module"`, top-level await): every relative import, in src, test **and
    templates**, gets `.js`. Changed by script: 43 imports, plus 10 files of the filled notes
    example.
  - **vitest 4 + vite 8** replace jest. Specs needed no API changes (describe/it/expect
    globals). Decorator metadata survives vite's compiler: the scaffold's DI-by-type test
    passed before any change.
  - **oxlint** replaces eslint, so prettier is now its own `format:check` and is part of
    `verify`.
  - **TypeScript 6**, a peer requirement of `@nestjs/schematics` 12.
  - **`nestjs-zod` removed:** no release, including `next`, supports Nest 12 (peer `^10 || ^11`).
    It is replaced by `src/common/zod/` (`createZodDto`, `ZodValidationPipe`, OpenAPI via
    `z.toJSONSchema`). Templates keep the same `extends createZodDto(Schema)` shape.
  - **pnpm 12** (corepack's current version, now pinned): `.npmrc` `frozen-lockfile` is
    **ignored**. Measured: a drifted package.json installed with exit 0 and rewrote the
    lockfile. Moved to `pnpm-workspace.yaml` `frozenLockfile: true`; after the move, a drifted
    install is refused with `ERR_PNPM_OUTDATED_LOCKFILE` and the lockfile is unchanged.
  - pnpm 12 fails the install on an unapproved build script: `@scarf/scarf` (Swagger UI's
    install-time telemetry). It is **denied** (`allowBuilds: false`), not approved. pnpm also
    recorded a minimum-release-age exception for `@nestjs/swagger@12.0.4`.
  - **nest-cli 12 accepts `--type rest --crud`.** The skill uses the flags. Control:
    `--type graphql-code-first` produced resolvers, so the flag is honoured, not ignored.
  - Without swagger, `nest g resource` adds `"@nestjs/mapped-types": "*"`; the template
    script now removes it when unused. Tested positive (removed) and negative (kept when
    imported).
  - Removed the scaffold's `deploy` script and `@nestjs/mau` (Nest's hosting CLI), which are
    outside this course.
- **A gap found and closed (it existed on Nest 11 too):** a validation pipe that validated
  but returned the RAW input was caught only by the pipe's unit test. All 12 e2e tests stayed
  green. Added the template e2e test "unknown keys are stripped" and the notes test "defaults
  applied over HTTP". With the pipe mutant, 2 of 14 e2e tests now fail.
- **Verified (scratch tree, before syncing into the repo):**
  - `tsc` 0, `oxlint` 0, `prettier --check` 0, check-ai-fill 0 markers / 0 stubs; unit
    `Tests 22 passed (22)` (4 files); e2e `Tests 14 passed (14)` (2 files).
  - Controls: planted type error gives tsc 2; planted floating promise gives oxlint 1;
    planted bad format gives prettier 1.
  - Mutations: R3, R4 and R5 each turned 1 of 10 unit tests red. Restoring `.partial()` for
    PATCH left unit 10/10 green and turned e2e 2/14 red.
  - The fresh render compared with the ported filled notes differs only in the 4 files that
    carry AI-FILL markers, and only at the marker regions.
  - Built server: `/api/health` 200; Swagger lists `CreateNoteDto` with 4 properties,
    `required: [title]`, and the status enum with its default; GET `/notes` lists the
    `limit`/`offset` query parameters; 422 and 400 bodies as specified; docs 404 in
    production; the log shows only the port.
  - Docker: build exit 0, `healthy`, user `node`, Node v24.22.1, docs 404, no vitest in the
    runtime image. Container and image removed (0 and 0 left).
  - Clean-room dogfood with `line-items`: fresh `nest g` (flags), then template, then frozen
    install exit 0; unfilled output passes tsc, oxlint and prettier; `verify` refuses with 8
    markers.
- **Re-measured on zod 4.6.7:** `.partial()` still re-applies defaults; refined objects still
  throw on `.omit()`/`.partial()`; default error text still does not echo input.

## 2026-10-25T19:57:07+08:00 — initial boilerplate

- **Changed:** created with `@nestjs/cli@11.0.21 new` (strict, pnpm). Added the shared core:
  validated env, `DomainError` + filter, repository port + in-memory adapter, page and patch
  schemas, health, and `configureApp` shared by `main.ts` and e2e. Added the resource
  templates, `apply-resource-template.mjs` and `check-ai-fill.mjs`. Generated `notes` with
  `nest g resource`, templated it and filled it from `specs/notes.md` as the worked example.
  Added 8 skills under `.claude/skills/`, plus `CLAUDE.md`, README, Dockerfile and
  `.env.example`.
- **Why Nest 11 (SUPERSEDED by the Nest 12 port above):** `nestjs-zod` 5.1.1 through 5.5.0 declares `@nestjs/common ^10 || ^11` as a
  peer. All dependencies are pinned exactly to the versions installed.
- **Verified:**
  - `pnpm verify` exit 0. typecheck 0; lint 0; check-ai-fill reported 24 files, 0 markers,
    0 stubs; unit `Tests: 18 passed` (3 suites); e2e `Tests: 12 passed` (2 suites).
  - Typecheck control: a planted `TS2322` was reported (exit 2).
  - Mutations: removing R3, R4 or R5 each turned 1 of 10 notes unit tests red. Restoring
    `.partial()` for PATCH left the unit tests green but turned 2 of 12 e2e tests red.
  - Template-script controls: refused before `nest g` (exit 1); refused a second run
    (exit 1); refused a non-kebab name (exit 1).
  - Clean-room dogfood of the full pipeline with `line-items` in a throwaway copy: the
    unfilled output passed typecheck and lint, and `verify` refused with 8 markers.
  - Built server: `/api/health` 200; `/api/docs` 200 (dev) and 404 (`NODE_ENV=production`);
    title change on a published note returned 422 `RULE_VIOLATION`; `?limit=500` returned
    400; `PORT=notaport` refused to boot naming `PORT`. The startup log shows only the port.
  - Docker: built on the host daemon, health status `healthy`, runs as user `node`, docs
    404, jest absent from the runtime image. Container and image removed afterwards
    (0 and 0 left).
- **Corrections during the build:**
  - The `SWAGGER_ENABLED` comment claimed "off in production" while the code defaulted to
    on. The code now matches the comment, with a test.
  - The `env.schema.ts` comment overclaimed that zod echoes inputs. It was reworded to the
    measured behaviour.
- **Open:** the package is not split into its own repo (no remote named). No database
  adapter yet (Lab 10.3 in the course). Template changes do not propagate to resources that
  were already filled (Lab 10.2).
