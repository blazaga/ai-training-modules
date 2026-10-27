# Chapter 04 — An MCP server on the database

**Your agent will:** build an MCP server that reads and writes `data/app.db` directly, over
stdio, so your **Claude Desktop** app can answer questions about the users and notes, and
change them. **Spec:** `specs/mcp.md`. **Check:** `npm run lab 02`.

## The shape

- A separate entrypoint, `src/mcp-server.ts` → `dist/mcp-server.js`, built with the MCP SDK
  (`McpServer` from `@modelcontextprotocol/server`, `StdioServerTransport` from its `/stdio`
  subpath). It is not a Nest app: your client starts it as a child process and talks to it on
  stdin/stdout (chapter 03).
- Eight tools: three to read the schema and data (`list-tables`, `describe-table`, `query`),
  one typed read (`notes-for-user`), and four writes (`create-note`, `update-note`,
  `share-note`, `unshare-note`).
- **Stdout belongs to the protocol.** Measured on the module 2 build: piping a raw
  `initialize` into `node dist/mcp-server.js` returns one JSON-RPC line naming `notes-db`,
  and the `mcp-server: ready (…)` line goes to stderr.

## A model writes the SQL, so the server decides what may run

`query` runs SQL that a model composed. "Read-only" is therefore a property the server has
to enforce, not a request it can make. The dry-run agent's design, and why each layer is
there:

| layer                                               | catches                                                                                      | measured by removing it                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| one statement, starting `SELECT` or `WITH`          | `select 1; delete from notes`: libSQL runs only the first statement and **reports no error** | e2e: 1 test red                                       |
| a separate connection with `PRAGMA query_only = ON` | a write hidden inside a read-looking statement: `with x as (select 1) delete from notes`     | e2e: 3 tests red (the hidden delete emptied the copy) |

A string check alone looks complete and is not; a database-level guard alone would let the
second statement of a pair slip through silently. **Each layer stops something the other
misses**, and the controls prove it.

## The rules live once

The write tools enforce the same rules as the REST API (an existing owner, a done note can
only be reopened, `dueAt` in UTC, never shared with the owner). The dry-run agent did not
write them again: the tools call the module 1 `NotesService`, with the module 1 zod schemas
as their input schemas. Removing the "never shared with the owner" check from the service
turned the MCP e2e test red too: one rule, two front doors, one test that notices.

Bad input needs no code: with a zod `inputSchema`, the SDK itself answers a tool error,
`Input validation error: …`, naming the field (measured on `@modelcontextprotocol/server`
2.4.0).

## What we measured building it

- **Module 2 checks:** `npm run verify` unit 60, e2e 55 in the agent's run (58 at the checkpoint,
  with the playground's test); `npm run lab 01` and `npm run lab 02` together
  25/25; `data/app.db` byte-identical afterwards (every test works on a copy).
- **A trap it found: the working directory.** The default `file:./data/app.db` is relative to
  where the process starts, and your client starts it from its own folder. The shared connect
  code then **creates an empty database** and the server answers with no tables. The agent
  made the server exit 1 when the file is missing; the spec now requires it, and the client
  command below uses absolute paths.
- **Two questions it asked through a real MCP client** (on a copy): "who has the most notes
  shared with them?" (`query`: Drew Graham, 10) and "what open notes does the busiest user
  have, including shared ones?" (`notes-for-user` with `status: open`: 9 owned, 2 shared).
  Asked to run `delete from notes`, the server answered
  `READ_ONLY: only a single SELECT (or WITH … SELECT) statement is allowed`.

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
2. **Try to break `query`.** Ask Claude Desktop to delete a note through `query`, then to do it
   with a `WITH` clause. Both must answer `READ_ONLY`, and the row count must not move.
3. **Change data through the tools, then check over REST.** Share a note from Claude Desktop,
   then look it up in the playground (`/playground`, **Who it is shared with**, with that note's
   id as `noteId`). Same database, two front doors.

Principles behind this chapter: P5 (verification), P8 (shipping safely).
