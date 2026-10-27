# Spec: the MCP server

- **Library (already installed):** `@rekog/mcp-nest` (tools as `@McpController` classes,
  transports for stdio and Streamable HTTP) and `zod` for tool parameters.
- **Server identity** (what clients see in `initialize`): `{ name: 'nest-ai-starter',
version: '0.1.0' }`.

## Module 4: tools over stdio

- `src/mcp/notes.tools.ts`, an `@McpController()` using `NotesService` (no logic of its own):

  | tool          | parameters                                          | result                            |
  | ------------- | --------------------------------------------------- | --------------------------------- |
  | `list-notes`  | `limit` 1–50 (default 10), `offset` ≥ 0 (default 0) | `{ items, total, limit, offset }` |
  | `get-note`    | `id` (UUID)                                         | the note                          |
  | `create-note` | the notes CREATE schema, reused (no second copy)    | the created note                  |

- `src/mcp/tool-result.ts`: a tool returns `{ content: [{ type: 'text', text: JSON }] }`. A
  `DomainError` (not found, rule violation) becomes a **tool error**: `isError: true`, text
  `"<CODE>: <message>"` (for example `RULE_VIOLATION: A published note needs a non-empty
body`), which the model can read. Any other error is a real failure and propagates.
- `src/mcp/mcp-tools.module.ts` holds every `@McpController`, so every transport serves the
  same tools.
- `src/mcp-stdio.ts`: a separate entrypoint (`pnpm mcp:stdio` = `node dist/mcp-stdio.js`).
  **Stdout belongs to the protocol**: Nest's logger is off, diagnostics go to stderr
  (`mcp-stdio: ready`).
- `test/mcp-stdio.e2e-spec.ts` spawns the built entrypoint and reads raw stdout: identity,
  the exact tool list, schemas generated from zod, a rule violation as a tool error, and no
  non-protocol line on stdout.

## Module 5: Streamable HTTP

- `src/bootstrap/attach-mcp.ts` mounts the same tools at **`/mcp`**, outside the `/api`
  prefix, on the app's own HTTP server; `main.ts` calls it before `listen`.
- Stateless (`statefulMode: false`), answers as Server-Sent Events (`enableJsonResponse:
false`): one `event: message` with `data: <JSON-RPC>`.
- DNS-rebinding protection: `allowedHosts` from `MCP_ALLOWED_HOSTS` (comma-separated,
  trimmed). Unset → the library's `'localhost'` shorthand, which allows `localhost`,
  `127.0.0.1` and `[::1]`: a literal `['localhost']` refuses the test client, which
  sends `Host: 127.0.0.1:<port>`. A request whose `Host` is not allowed gets 403.
- At this point `/mcp` has no authentication: an e2e test names that state, and module 6
  closes it (that test, and any `/mcp` test without device headers, then changes on
  purpose).

## Module 6: device authentication on `/mcp`

- Express middleware on `/mcp`, registered **before** the transport mounts its routes, so a
  failure is HTTP 401 before any JSON-RPC is read.
- Reads `X-Device-Key` and `X-Device-Secret` and calls `DevicesService.verifyDeviceKey`
  (`specs/devices.md`). Every failure (missing header, unknown key, wrong secret, archived
  device, rotated-away secret, a user's token instead) is the same 401 body,
  `{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid device credentials" }`.
- On success the device is attached to the request. A tool reads it through
  `McpContext.getRawRequest()` (`@Ctx()`), which is `undefined` over stdio. A `whoami` tool
  returns `{ device, owner }` (public fields only). Over stdio there is no device:
  `whoami` is the tool error `RULE_VIOLATION: No device identity: …`.
- Known limit, on purpose: only the device's own status is checked, so a disabled
  user's devices keep working until they are archived. Record it; deciding it is a
  discussion point.
- Never log the device headers.
