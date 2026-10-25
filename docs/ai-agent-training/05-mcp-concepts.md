# Chapter 05 — The Model Context Protocol: envelopes and transports

**You will:** learn what actually travels between an MCP client (an IDE, an agent) and
an MCP server, using **captures from this repo's own server** (chapters 06–09), not
diagrams. No code changes in this chapter.

## The pieces

- **Server:** exposes _tools_ (functions the model may call), _resources_ (readable data)
  and _prompts_. Ours exposes tools: `list-notes`, `get-note`, `create-note`, `whoami`.
- **Client:** connects, discovers what the server offers, and calls it on the model's
  behalf.
- **Message envelope:** **JSON-RPC 2.0**, in three shapes:

| shape        | has                                                | example                                                                                                            |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| request      | `jsonrpc`, `id`, `method`, `params`                | `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create-note","arguments":{"title":"over HTTP"}}}` |
| response     | `jsonrpc`, the same `id`, `result` **or** `error`  | below                                                                                                              |
| notification | `jsonrpc`, `method`, **no id** (no reply expected) | `{"jsonrpc":"2.0","method":"notifications/initialized"}`                                                           |

## The lifecycle, as captured

1. `initialize`: the client sends its protocol version and capabilities; the server
   answers with its own. Captured from our server:

   ```json
   {
     "result": {
       "protocolVersion": "2025-06-18",
       "capabilities": { "tools": { "listChanged": true }, "logging": {} },
       "serverInfo": { "name": "nest-ai-starter", "version": "0.1.0" }
     },
     "jsonrpc": "2.0",
     "id": 1
   }
   ```

2. `notifications/initialized`: the client confirms. No reply.
3. `tools/list`: discovery. Each tool carries a JSON Schema. Ours are **generated from
   the same zod schemas the REST API validates with**, so the model sees
   `minLength`, `enum`, defaults and `pattern`.
4. `tools/call`: execution. The result is content blocks:

   ```json
   {
     "result": { "content": [{ "type": "text", "text": "{ \"title\": \"over HTTP\", \"status\": \"draft\", … }" }] },
     "jsonrpc": "2.0",
     "id": 2
   }
   ```

### Two kinds of failure, deliberately different

- **Tool error** (`result.isError: true`): the tool ran and refused, e.g. an unknown id.
  The **model reads it** and can react:
  `{"content":[{"type":"text","text":"NOT_FOUND: Note … not found"}],"isError":true}`.
  Invalid arguments also come back this way, with messages from the zod schema, including
  cross-field rules.
- **Protocol error** (`error` instead of `result`): the request itself failed, e.g. our
  server answering a foreign `Host` with `{"error":{"code":-32000,"message":"Invalid Host: …"}}`.

## Transports: how the envelopes travel

| transport                     | how                                                                                                                     | who uses it           | trust                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------- |
| **stdio**                     | the client starts the server process; one JSON-RPC message per line on stdin/stdout                                     | local tools, IDEs     | the local user who started it       |
| **Streamable HTTP** (current) | the client POSTs JSON-RPC to one endpoint (`/mcp`); the server replies with JSON **or** a **Server-Sent Events** stream | remote/shared servers | must authenticate (chapter 09)      |
| HTTP+SSE (legacy)             | separate SSE and message endpoints                                                                                      | older servers         | deprecated in the spec (2025-03-26) |

**SSE is still there, inside Streamable HTTP.** Captured from our `/mcp` endpoint:

```
HTTP/1.1 200 OK
content-type: text/event-stream

event: message
data: {"result":{"protocolVersion":"2025-06-18", … },"jsonrpc":"2.0","id":1}
```

Two facts from measuring, not from the spec:

- With `@rekog/mcp-nest` 2.0.8 defaults (stateless), replies are **plain JSON, not SSE**
  (`enableJsonResponse` defaults to `!statefulMode`). We turned SSE on to see the frames
  (chapter 08).
- `@rekog/mcp-nest` 2.x ships `StdioTransport` and `StreamableHttpTransport` only, with no
  legacy SSE transport class. The course's "stdio → SSE" step is therefore "stdio →
  Streamable HTTP (which streams SSE)".

## Labs

1. Send the raw `initialize` with `curl` (chapter 08 shows the command). Identify request,
   response, `id` matching, and the SSE framing.
2. Classify: unknown tool name, a rule violation, invalid JSON. Tool error or protocol
   error? Check against the server.
3. Why must a stdio server never write logs to stdout? (Chapter 06 measures what actually
   happens.)
