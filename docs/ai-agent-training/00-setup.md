# Chapter 00 — Setup: Node, npm and one seeded SQLite file

**You need:** Node 24 (measured on 24.22; `package.json` also accepts 22.22.3 and later),
which brings npm with it. **The course assumes Windows**: install Node from
nodejs.org (the installer puts `node` on your `PATH`), Git for Windows, Claude Desktop for
module 2, and run the commands in **PowerShell** (Windows Terminal is fine). **You don't need** a database server: the
database is **SQLite**, a single file, `data/app.db`, and it ships **with data in it**.

In the workshop your agent works these steps out from the module 1 instruction; this chapter
is what it should do and what you check afterwards.

## Install

```powershell
cd boilerplate\nest-ai-starter
npm install                      # installs what package-lock.json lists
Copy-Item .env.example .env      # DATABASE_URL=file:./data/app.db, PORT=3000
```

- **Copy `.env.example` to `.env` before you start Claude Code.** `.env` holds your local
  settings (`PORT`, `DATABASE_URL`); git ignores it, so it never leaves your machine. The app,
  `npm run db:migrate` and the module 2 server read it, so you and your agent run them with
  the same settings. The tests never read it: they use an empty in-memory database.
- **Scripts run as `npm run <name>`** (`npm run verify`, `npm run lab 01`). A flag meant for
  the script goes after `--`, or npm keeps it for itself:
  `npm run resource:template -- --name note --plural notes`. `npm start` and `npm test` work
  without `run`.
- **One command per line.** Windows PowerShell 5.1 (the one most machines open) does not
  accept `&&` between commands; PowerShell 7 does. The course writes one per line.
- **No curl needed.** The app serves a playground page that sends every request from your
  browser (below).

**Port 3000 already taken?** Set another port in `.env` (`PORT=3100`) before starting, and
use that port wherever the course writes 3000 (the playground URL).

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

The data was generated with faker by `scripts/seed.mjs`. **`npm run db:seed` rebuilds the file
from scratch** (migrations, then the same rows: two runs write byte-identical files,
measured), so changing data while you experiment costs nothing.

## First, the tests: `npm run verify`

```powershell
npm run verify      # typecheck, lint, format, AI-FILL markers, migrations, unit, e2e
```

**Windows notes for the gate,** fixed in the base and measured on Linux, not yet on Windows:
the checks start their tools (`nest`, `prettier`, `drizzle-kit`) with `node` and each tool's
JavaScript entry, because the `node_modules\.bin` shims are `.cmd` files on Windows and a
program cannot start them directly; and the starter's `.gitattributes` keeps every text file
LF on checkout, so the formatting check does not fail on Git for Windows' CRLF conversion.

Measured on the base: exit 0, unit `Tests 21 passed`, e2e `Tests 5 passed`. **No test
touches `data/app.db`:** under test the app ignores `.env` (the vitest configs set
`NODE_ENV=test`), so the tests use an empty in-memory SQLite database, migrated from the same
committed SQL. You can run `npm run verify` while the app is running.

Why that matters: the e2e tests boot the whole app, and an app that read `.env` would open
the same file as your running app. We measured that state on an earlier build:
`SQLITE_BUSY: database is locked`, rows the tests expected to create already there, and a
failing run.

## Then run the app

```powershell
npm run build                              # compile to dist/
npm start                                  # http://localhost:3000, docs at /api/docs
```

Then open **http://localhost:3000/playground** in your browser and send **Health**: it answers
`{"status":"ok"}` (the page is described below).

`npm run start:dev` does the same with a file watcher: it rebuilds and restarts when you save.
On the base the app serves only health and the docs: the users and notes routes are what
module 1 adds.

The app never migrates a file database itself; `npm run db:migrate` does. The seeded file is
already migrated: measured, `npm run db:migrate` on it prints `ledger rows: 1` and leaves the
file byte-identical. You need it again only when a new migration is added.

## Trying the API: the playground page

With the app running, open **http://localhost:3000/playground**. The app serves a page that
lists every request of module 1 (health, users, notes and sharing). Each **Send** button calls
the real controller from your browser and shows the status, with a ✓ when it is the one the
specs expect, the time and the response body. **Run all in order** sends them top to bottom
and carries the ids along (the new user, the new note, a seeded friend); the variables are
editable at the top.

On the base only health is green: the users and notes routes answer 404, and the requests that
need an id wait for it. Once module 1 is built, every row turns ✓. Measured in a headless
Chromium against the module 1 + 2 build: 19 of 19 ✓, all four ids carried along, no script
errors; against the base: health ✓, 4 × 404, 14 waiting for an id. The requests write to your
`data/app.db`; `npm run db:seed` puts it back.

The page is served with the API docs (`SWAGGER_ENABLED`, on unless `NODE_ENV=production`). A
Postman collection with the same requests also lives in the starter (`postman/`), for anyone
who prefers Postman; the labs do not use it.

## Credentials

There are none: no database password (SQLite is a file, and access to it is access to
`data/`), and no authentication in this service (anyone who can reach it can change any row,
which is fine on your own machine and nowhere else). `.env` is git-ignored.

## Stop and clean up

Stop the app with Ctrl+C. To get the original data back, `npm run db:seed`.
