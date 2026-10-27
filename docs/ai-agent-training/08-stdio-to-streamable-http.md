# Chapter 08 — From stdio to Streamable HTTP: configuring nest-mcp

**Your agent will:** serve the same tools over HTTP inside the main app (module 5) and
configure the transport; you see the SSE frames. **Commit:** `course(ch08)`. **File:**
`src/bootstrap/attach-mcp.ts`.

> **About "SSE":** the MCP spec deprecated the old HTTP+SSE transport (2025-03-26), and
> `@rekog/mcp-nest` 2.0.8 ships only `StdioTransport` and `StreamableHttpTransport`.
> Streamable HTTP still **streams responses as Server-Sent Events**; this chapter shows the
> frames.

## Wiring (shared by `main.ts` and the e2e tests)

```ts
export async function attachMcp(app: INestApplication): Promise<void> {
  const mcp = new McpStrategy({
    ...MCP_SERVER_INFO,
    transports: [
      new StreamableHttpTransport({
        endpoint: '/mcp',
        statefulMode: false,
        enableJsonResponse: false, // stream SSE (default would be plain JSON)
        security: { allowedHosts: config.get('MCP_ALLOWED_HOSTS', { infer: true }) },
      }),
    ],
  });
  mcp.setHttpAdapter(app.getHttpAdapter());
  app.connectMicroservice({ strategy: mcp });
  await app.startAllMicroservices(); // before app.listen()
}
```

## Configuration: defaults read from the source, then measured

| option                                     | default                        | what it means here                                                                                                 |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `endpoint`                                 | `/mcp`                         | mounted on the HTTP adapter **outside** `/api` (measured: `/api/mcp` → 404)                                        |
| `statefulMode`                             | `false`                        | no `Mcp-Session-Id`; each POST stands alone (measured: `tools/call` with no session works)                         |
| `enableJsonResponse`                       | `!statefulMode`, i.e. **true** | by default replies are plain JSON, with **no SSE**. Set `false` to stream                                          |
| `security.allowedHosts` / `allowedOrigins` | localhost only                 | DNS-rebinding protection: any other `Host` is rejected                                                             |
| `protocol`                                 | `'dual'`                       | the type is `'dual' \| 'modern-only' \| 'legacy-only'` (protocol _eras_); we did not test the non-default postures |

### On the wire

```bash
curl -s -i -X POST http://localhost:3000/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

```
HTTP/1.1 200 OK
content-type: text/event-stream

event: message
data: {"result":{"protocolVersion":"2025-06-18",…,"serverInfo":{"name":"nest-ai-starter","version":"0.1.0"}},"jsonrpc":"2.0","id":1}
```

### The deployment trap: `MCP_ALLOWED_HOSTS`

Reproduced on one machine: the app reached **by the machine's hostname**, with **valid**
credentials, answered **403** with `{"error":{"code":-32000,"message":"Invalid Host: <hostname>"}}`.
`localhost` and `127.0.0.1` passed (200). With `MCP_ALLOWED_HOSTS=localhost,<hostname>` the
hostname answered 200 too. Set this in every deployment that is not reached as `localhost`.

### The instrument trap: `fetch` cannot test it

Our first e2e test for the Host check used `fetch` and got **200**: `Host` is a
forbidden header in the Fetch spec, and Node's `fetch` **silently replaces it** (an echo
server saw `localhost`). The test now uses `node:http`, with a one-variable control:
`localhost` → 200, `evil.example` → 403.

## The security finding this chapter ends on

At this point, **`tools/call` over HTTP works with no credentials.** Our global JWT
guard (chapter 03) does **not** cover MCP tool calls, because they are microservice
handlers, not HTTP controllers. The e2e test names this state explicitly, and chapter 09
closes it.

## Verify

e2e `Tests 58 passed`: a real HTTP client, the raw SSE framing, `/mcp` outside `/api`, and
the Host check.

## Labs

`pnpm lab 08` is red until your agent has built module 5, then green. Labs 1 and 2 are
experiments on that working state: have your agent flip one setting, watch `pnpm lab 08`
fail, revert, rebuild, and watch it pass again.

1. Set `enableJsonResponse: true` and capture the reply. What changed on the wire?
2. Turn on `statefulMode` and capture the `Mcp-Session-Id` header. What must the client
   now send back?
3. Call the running app by your machine's hostname (`curl http://$(hostname):3000/mcp …`)
   with and without that name in `MCP_ALLOWED_HOSTS`.
