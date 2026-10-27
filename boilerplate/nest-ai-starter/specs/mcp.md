# Spec: an MCP server on the SQLite database

An MCP server your own AI client (Claude Code, the MCP Inspector) can use to read and change
the data in `data/app.db`: the users, notes and shares the users and notes resources serve
over REST. It talks to the database **directly**, not through the REST API.

- **Libraries (already installed):** `@modelcontextprotocol/server` 2.x (`McpServer`;
  `StdioServerTransport` from `@modelcontextprotocol/server/stdio`), `@libsql/client` and
  `drizzle-orm` (the provided tables in `src/database/schema.ts`), `zod`.
- **Entrypoint:** `src/mcp-server.ts`, built to `dist/mcp-server.js`; add the script
  `"mcp": "node --env-file-if-exists=.env dist/mcp-server.js"`. It is **not** a Nest app.
- **Transport:** stdio. **Stdout belongs to the protocol**: nothing else may be written to
  it. Diagnostics go to stderr (`mcp-server: ready (<database>)`; the database file path is
  not a secret, unlike other config values).
- **Database:** `DATABASE_URL` (a `file:` URL), else `file:./data/app.db`, which is relative
  to the **working directory**. If the file does not exist, exit 1 with a message on stderr:
  the shared connect code would otherwise create an **empty** database and serve no data,
  which is what a client started from the wrong folder gets (measured by a dry-run agent).
  Foreign keys on (`PRAGMA foreign_keys = ON`).
- **Server identity** (what clients see in `initialize`): `{ name: 'notes-db', version:
'0.1.0' }`.

## Tools

| tool             | parameters                                                                           | result                                                                        |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `list-tables`    | none                                                                                 | `[{ table, rows }]` for `users`, `notes`, `note_shares`                       |
| `describe-table` | `table`: one of those three                                                          | its columns: `[{ name, type, notNull, primaryKey }]`                          |
| `query`          | `sql`: one read-only statement; `limit` 1–200 (default 50)                           | `{ rows, rowCount }`: at most `limit` rows; `rowCount` is the number returned |
| `notes-for-user` | `userId`; `include`: `owned` \| `shared` \| `all` (default `all`); optional `status` | the notes, each with `access: 'owner' \| 'shared'`                            |
| `create-note`    | `ownerId`, `title`, optional `body`, `dueAt`                                         | the created note                                                              |
| `update-note`    | `id`, and at least one of `title`, `body`, `status`, `dueAt`                         | the updated note                                                              |
| `share-note`     | `noteId`, `userId`                                                                   | `{ noteId, userId, shared: true }` (sharing twice is fine)                    |
| `unshare-note`   | `noteId`, `userId`                                                                   | `{ noteId, userId, shared: false }`                                           |

- Every result is `{ content: [{ type: 'text', text: <JSON> }] }`.
- **The write tools enforce the same rules as the REST API** (`specs/notes.md`): an existing
  owner (R1), a done note can only be reopened (R2), `dueAt` stored as `toISOString()` (R3),
  never shared with its owner (R4). Validate inputs with zod; reuse the notes and users
  schemas from module 1 where they fit rather than writing a second copy.
- **`query` is read-only.** Anything that is not a single read statement (`SELECT`, or a
  `WITH … SELECT`) is refused, and the database is unchanged afterwards. Do not rely on
  string checks alone: a statement can hide a write.
- **Errors the model can read:** a broken rule or a missing row is a **tool error**:
  `isError: true`, text `"<CODE>: <message>"`, codes `NOT_FOUND`, `RULE_VIOLATION`,
  `READ_ONLY` (a write sent to `query`). Bad input needs no code of yours: give each tool a
  zod `inputSchema` and the SDK answers a tool error itself (`Input validation error: …`,
  naming the field; measured on `@modelcontextprotocol/server` 2.4.0). Anything else is a bug:
  the SDK catches it and returns it as a tool error with its raw message and no code, so never
  throw for a case the spec names.

## Tests

`test/mcp-server.e2e-spec.ts` spawns the built entrypoint against a **copy** of the seeded
database (never `data/app.db` itself), reads raw stdout, and covers: the identity, the exact
tool list, a read, each write and its rule violations, and a write sent to `query`.

## Using it from Claude Desktop

The goal of module 2: your **Claude Desktop** app talks to this server and answers questions
about the data. Claude Desktop starts the server itself, from its own working folder and with a
minimal `PATH`, so its config needs **absolute** paths: for `node`, for the built server, and
for the database. The base prints that entry for your machine:

```powershell
npm run build
node scripts\claude-desktop-config.mjs      # prints the config file path and the entry to paste
```

1. Open the config file: Claude Desktop → Settings → Developer → Edit Config, or the path the
   script names (Windows: `%APPDATA%\Claude\claude_desktop_config.json`; macOS:
   `~/Library/Application Support/Claude/claude_desktop_config.json`). If it does not exist,
   create it with exactly the printed JSON; otherwise add the `"notes-db"` entry inside its
   `"mcpServers"` object.
2. **Quit and reopen** Claude Desktop (on Windows, also quit it from the system tray). The
   `notes-db` tools then appear in its tools menu.
3. Ask it about the data: "Which open notes are shared with more than one person?"

Measured on the module 2 build, on Linux (no Claude Desktop there): the printed entry,
started from another working folder with nothing but its own command, arguments and
environment, answers `initialize` as `notes-db`, lists the three tables with their row
counts, and runs a read-only query. The config format is Claude Desktop's documented
`mcpServers` form.

**Other clients:** the same command and `DATABASE_URL` work in the MCP Inspector
(`npm run mcp:inspect:ui`, transport stdio) and in Claude Code
(`claude mcp add notes-db -e DATABASE_URL="file:$PWD/data/app.db" -- node "$PWD/dist/mcp-server.js"`).

The write tools change your real `data/app.db`: `npm run db:seed` rebuilds it.
