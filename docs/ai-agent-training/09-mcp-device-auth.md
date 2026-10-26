# Chapter 09 — Authenticating MCP with device access keys

**You will:** require a device's `AccessKeyId` + secret (chapter 04) on the MCP HTTP
endpoint, and give tools the caller's identity. **Commit:** `course(ch09)`. **Files:**
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

## The check (all of it lives in chapter 04's `verifyAccessKey`)

```
X-Access-Key-Id: AKID…        X-Secret-Key: dsk_…
```

The key id must exist, the secret must match its sha256 (timing-safe), and the device must
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
- **Seven failures, one identical 401:** no headers, key id only, unknown key id, wrong
  secret, draft device, archived device, rotated-away secret.
- Mutations: auth not registered → 2 fail; device status unchecked → 1 fails; middleware
  after mount → 2 fail. The chapter 08 test that pinned the "open" state failed with
  exactly the new 401 when it ran against chapter 09 code.

## The Inspector with device keys, and a limit to state honestly

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:3000/mcp \
  --method tools/call --tool-name whoami \
  --header "X-Access-Key-Id: AKID…" --header "X-Secret-Key: <SECRET>"
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
device → credentials → activate → **MCP `whoami` 200** with the right device; no
credentials 401. The `MCP_ALLOWED_HOSTS` trap from chapter 08, reproduced: `localhost` and
`127.0.0.1` pass by default (200), the machine's hostname is refused (403 `Invalid Host`),
and `MCP_ALLOWED_HOSTS=localhost,<hostname>` lets it through (200).

## Verify

Unit `Tests 67 passed`, e2e `Tests 61 passed`.

## Labs

Lab 3 is checked: `pnpm lab 09` pins what rotation does to a connected client (the
old secret fails on the very next call). It passes on the starter; to see it fail, let a
non-active device through `verifyAccessKey`.

1. Scope `list-notes` to the calling device's owner. What changes in `NotesService`
   (compare chapter 04's ownership)?
2. Add rate limiting per access key id. Where does it go: middleware or tool?
3. Rotate a device's secret while a client is connected. What does the client see on
   its next request?
