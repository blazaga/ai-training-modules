# Chapter 04 — An MCP server on the database

**Your agent will:** build an MCP server that reads and writes `data/app.db` directly, over
stdio, so your **Claude Desktop** app can answer questions about the users and notes, and
change them. **Spec:** `specs/mcp.md`. **Check:** `npm run lab 02`.

## The shape

- A separate entrypoint, `src/mcp-server.ts` → `dist/mcp-server.js`, built with the MCP SDK
  (`McpServer` from `@modelcontextprotocol/server`, `StdioServerTransport` from its `/stdio`
  subpath). It is not a Nest app: your client starts it as a child process and talks to it on
  stdin/stdout (chapter 03).
- **Read tools:** `list-tables`, `describe-table`, `query` (any read-only SQL) and the typed
  `notes-for-user`.
- **Write tools:** typed ones that apply the module 1 rules (`create-user`, `create-note`,
  `update-note`, `delete-note`, `share-note`, `unshare-note`), and `execute`, one SQL
  `INSERT`, `UPDATE` or `DELETE`, for what the typed tools do not cover.
- Each tool carries MCP annotations saying whether it only reads (`readOnlyHint`) or can
  destroy data (`destructiveHint`).
- **Stdout belongs to the protocol.** Measured on the module 2 build: piping a raw
  `initialize` into `node dist/mcp-server.js` returns one JSON-RPC line naming `notes-db`,
  and the `mcp-server: ready (…)` line goes to stderr.

## A model writes the SQL, so the server decides what may run

`query` and `execute` run SQL that a model composed. What may run is therefore a property the
server has to enforce, not a request it can make. The dry-run agent's design, and what each
layer catches. Every row was measured by removing that one layer from the built server and
running the checks again:

| tool      | layer                                                      | catches                                                                                      | red when removed         |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `query`   | exactly one statement, starting `SELECT` or `WITH`         | `select 1; delete from notes`: libSQL runs only the first statement and **reports no error** | agent's e2e 1 · lab 02 1 |
| `query`   | `PRAGMA query_only = ON`, in a transaction never committed | a write behind a read-looking start: `with x as (select 1) delete from notes`                | agent's e2e 1 · lab 02 1 |
| `execute` | exactly one statement                                      | `delete … where …; delete from notes where 1 = 1`                                            | agent's e2e 0 · lab 02 1 |
| `execute` | the statement is an `INSERT`, `UPDATE` or `DELETE`         | anything else that carries a `WHERE`: `create view … where 1 = 1`                            | agent's e2e 0 · lab 02 1 |
| `execute` | an `UPDATE` or `DELETE` needs a top-level `WHERE`          | `delete from notes`: one careless sentence emptying a table                                  | agent's e2e 1 · lab 02 1 |

Two things to take from it:

- **A string check alone looks complete and is not**; a database-level guard alone would let
  the second statement of a pair slip through silently. Each layer stops something the
  others miss.
- **The agent's own tests missed two of its five guards.** Both were still there and correct;
  nothing would have noticed if a later change removed them. The lab checks were written
  from the spec, not from the code, and catch all five. (The statement-type check was masked
  in a first version of the lab too: every statement it refused also lacked a `WHERE`, so the
  `WHERE` guard refused it first. Two cases with a `WHERE` were added.)

`execute` keeps foreign keys on, so the database still refuses a note with an unknown owner
(`CONSTRAINT`). It does **not** apply the business rules that live in the services (a done
note can only be reopened, never shared with its owner); its tool description tells the
model so and points it to the typed tools.

## The rules live once

The typed write tools enforce the same rules as the REST API (a unique email, an existing
owner, a done note can only be reopened, `dueAt` in UTC, never shared with the owner). The
dry-run agent did not write them again: the tools call the module 1 `UsersService` and
`NotesService`, with the module 1 zod schemas as their input schemas. Removing the "never
shared with the owner" check from `NotesService` turned the MCP e2e test and lab 02 red too:
one rule, two front doors, one check that notices.

Bad input needs no code: with a zod `inputSchema`, the SDK itself answers a tool error,
`Input validation error: …`, naming the field (measured on `@modelcontextprotocol/server`
2.4.0).

## What we measured building it

- **Module 2 checks:** `npm run verify` unit 47, e2e 58 at the checkpoint (46 in the agent's run, before the base gained one test); `npm run lab` (labs 01 and 02)
  31/31; `data/app.db` byte-identical afterwards (every test works on a copy).
- **Two driver facts it measured** (`@libsql/client` 0.18): a read-only _transaction_ did not
  stop a `delete`, which is why `query` sets `PRAGMA query_only` instead; and an `UPDATE …
RETURNING` reports `rowsAffected` 0 although it changed 115 rows, so `execute` counts the
  returned rows in that case.
- **A trap: the working directory.** The default `file:./data/app.db` is relative to where the
  process starts, and your client starts it from its own folder. The shared connect code then
  **creates an empty database** and the server answers with no tables. The spec requires the
  server to exit 1 when the file is missing, and the client command below uses absolute paths.
- **A session as Claude Desktop runs it** (the printed entry started from `/` with only its own
  environment, on a copy of the project): `list-tables` → users 25, notes 200, shares 120;
  `create-user` stored `Ada.Lovelace@Example.com` lower-cased; `create-note` stored a due date
  of `2026-11-06T17:00:00+08:00` as `2026-11-06T09:00:00.000Z`; `share-note` with the busiest
  user; `execute` set the note's body (`rowsAffected: 1`); `update-note` marked it done; a
  `query` join showed all of it. `delete from notes` answered `READ_ONLY` through `query` and
  `NOT_ALLOWED: DELETE without a WHERE clause would change every row` through `execute`;
  the counts afterwards were 26, 201 and 121.

## Connect it to Claude Desktop

This is the goal of the workshop: your Claude Desktop app, talking to the server your agent
built, answering questions from the SQLite file.

Claude Desktop starts the server itself, **from its own working folder and with a minimal
`PATH`**. Two things then break for anyone new to Node: a bare `node` may not be found (nvm
and similar installs are not on a desktop app's `PATH`), and a relative `dist/mcp-server.js`
or `data/app.db` points nowhere. So the config entry uses absolute paths for all three, and
the base prints it for your machine:

```powershell
npm run build
node scripts\claude-desktop-config.mjs
```

It prints where the config file is and the entry to paste. On Windows it looks like this (the
script fills in your own paths):

```json
{
  "mcpServers": {
    "notes-db": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\you\\workshop\\nest-ai-starter\\dist\\mcp-server.js"],
      "env": { "DATABASE_URL": "file:C:/Users/you/workshop/nest-ai-starter/data/app.db" }
    }
  }
}
```

Backslashes are doubled inside JSON strings; the database URL uses forward slashes, which is
what libSQL expects (measured: its parser reads `file:C:/Users/…/app.db` as the path
`C:/Users/…/app.db`, with no host).

1. Open the config file: in Claude Desktop, **Settings → Developer → Edit Config** (Claude
   Desktop's documentation), or the path the script prints, on Windows
   `%APPDATA%\Claude\claude_desktop_config.json` (macOS:
   `~/Library/Application Support/Claude/claude_desktop_config.json`). No file yet: create it with exactly the printed JSON. A file already there:
   add the `"notes-db"` entry inside its `"mcpServers"` object.
2. **Quit Claude Desktop completely and reopen it** (on Windows, also from the system tray:
   closing the window leaves it running). The `notes-db` tools appear in the tools
   menu of a new chat.
3. Ask it something: "Which open notes are shared with more than one person?"

**What we measured,** on the module 2 build, on Linux, without Claude Desktop: the
printed entry, started from another working folder with nothing but its own command, arguments
and environment (as Claude Desktop does), answered `initialize` as `notes-db`, listed
`users 25, notes 200, note_shares 120`, and ran a read-only query (`done 85, open 115`). Run
on the base, before the server exists, the script warns and exits 1. The JSON is Claude
Desktop's documented `mcpServers` form.

**Not connecting?** The server writes its reason to stderr, which Claude Desktop keeps in its
MCP log (Windows `%APPDATA%\Claude\logs\`, macOS `~/Library/Logs/Claude/`, per Claude
Desktop's documentation; not measured here): a missing
`data/app.db` exits with a message saying so. Rerun the script after moving the project folder:
the paths in the entry are absolute.

Other clients work with the same command and `DATABASE_URL`: the MCP Inspector
(`npm run mcp:inspect:ui`, transport stdio) and Claude Code (`claude mcp add notes-db -e
DATABASE_URL="file:$PWD/data/app.db" -- node "$PWD/dist/mcp-server.js"`). The write tools
change your real `data/app.db`; `npm run db:seed` puts it back.

## Labs

Module 2, built by your agent from the proctor's instruction, checked with `npm run lab 02`.

1. **Ask Claude Desktop about the data.** Which open notes are shared with more than one
   person? Whose notes are overdue? Watch which tools it chooses, and read the SQL it sends to
   `query`.
2. **Ask it to change the data.** "Add a user Ada Lovelace, ada@example.com, with a note
   'Write the first program' due next Friday, and share it with the busiest user." Read each
   tool call before you allow it: which tools did it pick, and did it use `execute` where a
   typed tool exists? Then ask it to show you the result with `query`.
3. **Try to break it.** Ask Claude Desktop to delete a note through `query`, then to empty the
   notes table through `execute`. The first must answer `READ_ONLY`, the second
   `NOT_ALLOWED`, and the row counts must not move.
4. **Check over REST.** Look the new user and note up in the playground (`/playground`, with
   their ids as `userId` and `noteId`). Same database, two front doors.

Principles behind this chapter: P5 (verification), P8 (shipping safely).
