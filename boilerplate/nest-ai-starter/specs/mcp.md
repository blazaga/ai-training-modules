# Spec: an MCP server on the SQLite database

An MCP server your own AI client (Claude Desktop, Claude Code, the MCP Inspector) can use to
**query and change** the data in `data/app.db`: the users, notes and shares the users and notes resources serve
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

Read tools:

| tool             | parameters                                                                           | result                                                                        |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `list-tables`    | none                                                                                 | `[{ table, rows }]` for `users`, `notes`, `note_shares`                       |
| `describe-table` | `table`: one of those three                                                          | its columns: `[{ name, type, notNull, primaryKey }]`                          |
| `query`          | `sql`: one read-only statement; `limit` 1–200 (default 50)                           | `{ rows, rowCount }`: at most `limit` rows; `rowCount` is the number returned |
| `notes-for-user` | `userId`; `include`: `owned` \| `shared` \| `all` (default `all`); optional `status` | the notes, each with `access: 'owner' \| 'shared'`                            |

Write tools:

| tool           | parameters                                                   | result                                                     |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `create-user`  | `email`, `name`                                              | the created user                                           |
| `create-note`  | `ownerId`, `title`, optional `body`, `dueAt`                 | the created note                                           |
| `update-note`  | `id`, and at least one of `title`, `body`, `status`, `dueAt` | the updated note                                           |
| `delete-note`  | `id`                                                         | `{ id, deleted: true }`; its shares go with it             |
| `share-note`   | `noteId`, `userId`                                           | `{ noteId, userId, shared: true }` (sharing twice is fine) |
| `unshare-note` | `noteId`, `userId`                                           | `{ noteId, userId, shared: false }`                        |
| `execute`      | `sql`: one `INSERT`, `UPDATE` or `DELETE` statement          | `{ rowsAffected }`                                         |

- Every result is `{ content: [{ type: 'text', text: <JSON> }] }`.
- **The typed write tools enforce the same rules as the REST API** (`specs/users.md`,
  `specs/notes.md`): a unique email, stored lower-cased (users R1), an existing owner (R1), a
  done note can only be reopened (R2), `dueAt` stored as `toISOString()` (R3), never shared
  with its owner (R4). Validate inputs with zod; reuse the users and notes schemas from module
  1 where they fit rather than writing a second copy.
- **`query` is read-only.** Anything that is not a single read statement (`SELECT`, or a
  `WITH … SELECT`) is refused, and the database is unchanged afterwards. Do not rely on
  string checks alone: a statement can hide a write.
- **`execute` is the SQL write path**, for what the typed tools do not cover (an `UPDATE`
  across many rows, an `INSERT` of several rows). Exactly one statement, and it must be an
  `INSERT`, `UPDATE` or `DELETE`; an `UPDATE` or `DELETE` without a `WHERE` clause is refused
  too, so one careless sentence cannot empty a table. Refused means nothing ran and the
  database is unchanged: schema changes (`CREATE`, `DROP`, `ALTER`), `PRAGMA`, `ATTACH`,
  `SELECT` (that is `query`), and more than one statement. Foreign keys stay on, so the
  database's own constraints (an existing owner, a unique email, `NOT NULL`) still hold. The
  business rules R2 and R4 are **not** checked here; the tool's description must say so and
  point the model to the typed tools, and must state the formats a hand-written row needs:
  `id` a v4 UUID, every timestamp an ISO-8601 UTC string (`toISOString()`), `status` `open` or
  `done`.
- **Tell the client which tools write.** Give each tool MCP annotations: the read tools
  `readOnlyHint: true`; the write tools `readOnlyHint: false`, and `delete-note`, `unshare-note`
  and `execute` also `destructiveHint: true`. They are hints a client may show or act on
  when it asks you to approve a call, not a security boundary: the server's own checks are.
- **Errors the model can read:** a broken rule, a missing row or a refused statement is a
  **tool error**: `isError: true`, text `"<CODE>: <message>"`, codes `NOT_FOUND`,
  `RULE_VIOLATION`, `CONFLICT` (an email already taken), `READ_ONLY` (a write sent to
  `query`), `NOT_ALLOWED` (a statement `execute` refuses) and `CONSTRAINT` (a statement
  `execute` ran that the database rejected; the message is SQLite's). Bad input needs no code
  of yours: give each tool a zod `inputSchema` and the SDK answers a tool error itself
  (`Input validation error: …`, naming the field; measured on `@modelcontextprotocol/server`
  2.4.0). Anything else is a bug: the SDK catches it and returns it as a tool error with its
  raw message and no code, so never throw for a case the spec names.

## Tests

`test/mcp-server.e2e-spec.ts` spawns the built entrypoint against a **copy** of the seeded
database (never `data/app.db` itself), reads raw stdout, and covers: the identity, the exact
tool list and its annotations, a read, each write and its rule violations, a write sent to
`query`, and each kind of statement `execute` refuses.

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
3. Ask it about the data, then ask it to change some. For example: "Which open notes are
   shared with more than one person?", "Add a user Ada Lovelace, ada@example.com, and give
   her a note 'Write the first program' due next Friday", "Ada finished it: mark it done and
   show me her notes". When Claude Desktop asks to run a tool, read the arguments (for
   `execute`, the SQL) before you allow it.

Measured on the module 2 build, on Linux (no Claude Desktop there): the printed entry,
started from another working folder with nothing but its own command, arguments and
environment, answers `initialize` as `notes-db`, lists the three tables with their row
counts, runs a read-only query, creates a user and a note, shares the note, changes it through
`execute` and a typed tool, and refuses `delete from notes` through both `query` and
`execute`. The config format is Claude Desktop's documented
`mcpServers` form.

**Other clients:** the same command and `DATABASE_URL` work in the MCP Inspector
(`npm run mcp:inspect:ui`, transport stdio) and in Claude Code
(`claude mcp add notes-db -e DATABASE_URL="file:$PWD/data/app.db" -- node "$PWD/dist/mcp-server.js"`).

The write tools change your real `data/app.db`: `npm run db:seed` rebuilds it.
