# Chapter 00 — Setup: Node, pnpm and one seeded SQLite file

**You need:** Node 24 (measured on 24.22; `package.json` also accepts 22.22.3 and later) and
pnpm through corepack, which ships with Node. **The course assumes Windows**: install Node from
nodejs.org (the installer puts `node` on your `PATH`), Git for Windows, Claude Desktop for
module 2, and run the commands in **PowerShell** (Windows Terminal is fine). **You don't need** a database server: the
database is **SQLite**, a single file, `data/app.db`, and it ships **with data in it**.

In the workshop your agent works these steps out from the module 1 instruction; this chapter
is what it should do and what you check afterwards.

## Install

```powershell
cd boilerplate\nest-ai-starter
corepack enable                  # puts the pinned pnpm (12.15.0) on your PATH
pnpm install
Copy-Item .env.example .env      # DATABASE_URL=file:./data/app.db, PORT=3000
```

- **`corepack enable` refused?** It writes into the Node install folder, which on Windows
  usually needs a terminal opened with **Run as administrator** (measured on Linux: `EACCES`
  without admin rights). Without it, write `corepack pnpm` wherever this course writes `pnpm`.
- **One command per line.** Windows PowerShell 5.1 (the one most machines open) does not
  accept `&&` between commands; PowerShell 7 does. The course writes one per line.
- **`curl` in PowerShell** is an alias for `Invoke-WebRequest` in Windows PowerShell 5.1; write
  `curl.exe` for the real curl (it ships with Windows 10 and 11), or use Postman.

**Port 3000 already taken?** Set another port in `.env` (`PORT=3100`) before starting, and
use that port wherever the course writes 3000 (the Postman `baseUrl`, curl).

## The data

`data/app.db` is committed, already migrated and seeded, so there is something to work with
from the first minute. Measured on the base:

| table         | rows | what                                                        |
| ------------- | ---- | ----------------------------------------------------------- |
| `users`       | 25   | name and email (every email is at `example.com`)            |
| `notes`       | 200  | the TODO items: 115 `open`, 85 `done`; each owned by a user |
| `note_shares` | 120  | a note shared with another user (never with its owner)      |

The tables are provided (`src/users/users.table.ts`, `src/notes/notes.table.ts`,
`src/notes/note-shares.table.ts`); the REST resources on top of them are what your agent
builds in module 1, and the MCP server that reads and writes the file directly is module 2.

The data was generated with faker by `scripts/seed.mjs`. **`pnpm db:seed` rebuilds the file
from scratch** (migrations, then the same rows: two runs write byte-identical files,
measured), so changing data while you experiment costs nothing.

## Run the app

```powershell
pnpm build                              # compile to dist/
pnpm start                              # http://localhost:3000, docs at /api/docs
curl.exe localhost:3000/api/health      # in a second terminal: {"status":"ok"}
```

`pnpm start:dev` does the same with a file watcher: it rebuilds and restarts when you save.
On the base the app serves only health and the docs: the users and notes routes are what
module 1 adds.

The app never migrates a file database itself; `pnpm db:migrate` does. The seeded file is
already migrated: measured, `pnpm db:migrate` on it prints `ledger rows: 1` and leaves the
file byte-identical. You need it again only when a new migration is added.

## The gate: `pnpm verify`

```powershell
pnpm verify      # typecheck, lint, format, AI-FILL markers, migrations, unit, e2e
```

**Windows notes for the gate,** fixed in the base and measured on Linux, not yet on Windows:
the checks start their tools (`nest`, `prettier`, `drizzle-kit`) with `node` and each tool's
JavaScript entry, because the `node_modules\.bin` shims are `.cmd` files on Windows and a
program cannot start them directly; and the starter's `.gitattributes` keeps every text file
LF on checkout, so the formatting check does not fail on Git for Windows' CRLF conversion.

Measured on the base: exit 0, unit `Tests 20 passed`, e2e `Tests 2 passed`. **No test
touches `data/app.db`:** under test the app ignores `.env` (the vitest configs set
`NODE_ENV=test`), so the tests use an empty in-memory SQLite database, migrated from the same
committed SQL. You can run `pnpm verify` while the app is running.

Why that matters: the e2e tests boot the whole app, and an app that read `.env` would open
the same file as your running app. We measured that state on an earlier build:
`SQLITE_BUSY: database is locked`, rows the tests expected to create already there, and a
failing run.

## Calling the API with Postman

The REST calls of module 1 are in a Postman collection:
`boilerplate/nest-ai-starter/postman/nest-ai-starter.postman_collection.json`. Import it,
keep `baseUrl` at `http://localhost:3000`, and run the folders in order (01 stores the ids
02 uses). Each request has tests: read the Test Results tab, not only the status code. They
write to your `data/app.db`; `pnpm db:seed` puts it back.

## Credentials

There are none: no database password (SQLite is a file, and access to it is access to
`data/`), and no authentication in this service (anyone who can reach it can change any row,
which is fine on your own machine and nowhere else). `.env` is git-ignored.

## Stop and clean up

Stop the app with Ctrl+C. To get the original data back, `pnpm db:seed`.
