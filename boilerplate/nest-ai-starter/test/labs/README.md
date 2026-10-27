# Lab checks

Each module has a check: a test file that drives what your agent built the way a client
would, over HTTP (lab 01) or over MCP on stdio (lab 02). Your running app is not used, so
there is nothing to restart first. The check never imports your code, so it tells you whether
the lab **behaves** as asked, not how you built it.

```bash
npm run lab 01      # one lab (any part of the file name works: 01, users, mcp, …)
npm run lab         # every lab
```

**Read the counts.** A lab is done when its check reports `Test Files 1 passed` and every
test in `Tests` passed. A failure message names the rule it checks and usually says where
the fix belongs. `npm run verify` must stay green as well: the lab checks are extra, not a
replacement for your own tests.

Both checks are red on the base you start from, because the feature does not exist yet, and
green once your agent has built it. After that, **break** a rule your agent built: watch the
check fail, put the rule back, and watch it pass again. A check that stays green while you
break its rule means the rule is not where you think it is.

| check            | lab                                  | module | spec                               |
| ---------------- | ------------------------------------ | ------ | ---------------------------------- |
| `01-users-notes` | the users and notes resources (REST) | 1      | `specs/users.md`, `specs/notes.md` |
| `02-mcp-server`  | an MCP server on the SQLite database | 2      | `specs/mcp.md`                     |

## The data

- **Lab 01** starts the app on an **empty in-memory** database, so it creates every row it
  needs. It never touches `data/app.db`.
- **Lab 02** builds the project and starts `dist/mcp-server.js` on a **copy** of the seeded
  `data/app.db`, then reads the copy directly to check what each tool did. The expected
  values come from the data, not from fixed numbers, so re-seeding does not break it.

## The contracts

The specs are the contracts: `specs/users.md`, `specs/notes.md` (module 1) and
`specs/mcp.md` (module 2). The checks hold your agent to exactly what they say, including:

- **01:** email unique case-insensitively (409); a user who owns notes cannot be deleted
  (409); a note's owner must exist (422) and cannot be changed by a PATCH; a done note can
  only be reopened (422); `dueAt` stored as UTC `toISOString()`; list filters `ownerId`,
  `sharedWith`, `status`; sharing is idempotent, never with the owner (422), and cascades
  when the note or the friend is deleted.
- **02:** the server identity `notes-db` and exactly eight tools; real row counts; `query`
  runs reads and refuses every write with `READ_ONLY` (the data stays unchanged); the write
  tools keep the notes rules (`RULE_VIOLATION`, `NOT_FOUND`); bad input is a tool error that
  names the field.

## When a check fails and you think you are right

Read the assertion: it names the rule and the request. Then reproduce the request yourself
(the playground page at `/playground` sends every REST call with one click; the MCP Inspector or Claude Desktop can call
the tools), and compare what the spec says with what was built. A difference there is the
bug, in one of the two.
