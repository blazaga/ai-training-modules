# Chapter 09 — Authenticating MCP with device keys

**Your agent will:** require a device's key + secret (chapter 04) on the MCP HTTP endpoint
(module 6), and
give tools the caller's identity. **Files:**
`src/mcp/device-auth.middleware.ts`, `src/mcp/identity.tools.ts`,
`src/bootstrap/attach-mcp.ts`.

## Where to authenticate: transport, not tool

A Nest guard on the tool controller would turn "no credentials" into a JSON-RPC error
inside an HTTP **200**. An HTTP transport should fail authentication with **HTTP 401
before any JSON-RPC is read**, so the check is Express middleware on `/mcp`:

```ts
// attach-mcp.ts, BEFORE the transport mounts its routes
app.use('/mcp', deviceAuth(app.get(DevicesService, { strict: false })));
```

**Order is load-bearing, and measured:** with the middleware registered only _after_
`startAllMicroservices()`, the auth is bypassed and 2 e2e tests fail.

## The check (all of it lives in chapter 04's `verifyDeviceKey`)

```
X-Device-Key: DK…        X-Device-Secret: dsk_…
```

The key must exist, the secret must match its sha256 (timing-safe), and the device must
be **active**. A rotated-away secret fails at once, because nothing is cached. On success
the device is attached to the request, and tools read it through `McpContext`:

```ts
@Tool({ name: 'whoami', description: 'The device making this call and its owner.', parameters: z.object({}) })
whoami(@Ctx() ctx: McpContext) {
  const device = ctx.getRawRequest<DeviceRequest>()?.mcpDevice;   // undefined on stdio
  …
}
```

## What the tests prove

- An **active** device: a real MCP client lists and calls tools, and `whoami` returns
  _that_ device and _its_ owner, with no hash in the output.
- **Six failures, one identical 401:** no headers, key only, unknown key, wrong secret,
  archived device, rotated-away secret.
- Mutations (measured): auth not registered → 2 fail; middleware after mount → 2 fail;
  archived devices accepted → 1 fails.
- The `/mcp` endpoint takes **device** credentials only. A user's bearer token or Basic
  header gets the same 401 (`pnpm lab 09` checks both): users and devices are different
  kinds of client.

## The Inspector with device keys, and a limit to state honestly

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:3000/mcp \
  --method tools/call --tool-name whoami \
  --header "X-Device-Key: $DEVICE_KEY" --header "X-Device-Secret: $DEVICE_SECRET"
```

That works. **Without** headers, the Inspector treats our 401 as an **OAuth challenge**
(the MCP authorization spec) and exits 3 with `auth_required`. Device keys are a custom
scheme for **machine clients configured with headers**. Interactive clients that expect
OAuth need the spec's OAuth flow; `@rekog/mcp-nest-auth` is the package for that (not built
in this course).

## Trust boundaries, stated

| transport       | who is trusted                            | identity in tools              |
| --------------- | ----------------------------------------- | ------------------------------ |
| stdio           | the local user who started the process    | none: `whoami` is a tool error |
| Streamable HTTP | only an active device with a valid secret | the device + its owner         |

## End-to-end check (the built app on its SQLite file)

`pnpm build`, `pnpm db:migrate` (ledger 3 rows, idempotent), `pnpm start` → sign-up →
log in → provision → **MCP `whoami` 200** with the right device; no credentials 401. The `MCP_ALLOWED_HOSTS` trap from chapter 08, reproduced: `localhost` and
`127.0.0.1` pass by default (200), the machine's hostname is refused (403 `Invalid Host`),
and `MCP_ALLOWED_HOSTS=localhost,<hostname>` lets it through (200).

## Labs

Lab 3 is the end of module 6, checked with `pnpm lab 09`: it pins what rotation does to a
connected client (the old secret fails on the very next call). It is red until your agent has
built module 6. To see it pin the rule, have your agent let an archived device through
`verifyDeviceKey`, watch it fail, and revert.

1. Scope `list-notes` to the calling device's owner. What changes in `NotesService`
   (compare chapter 04's ownership)?
2. Add rate limiting per device key. Where does it go: middleware or tool?
3. Rotate a device's secret while a client is connected. What does the client see on
   its next request?
