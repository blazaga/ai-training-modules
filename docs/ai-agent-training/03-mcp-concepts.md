# Chapter 03 — The Model Context Protocol: envelopes and transports

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
| **Streamable HTTP** (current) | the client POSTs JSON-RPC to one endpoint (`/mcp`); the server replies with JSON **or** a **Server-Sent Events** stream | remote/shared servers | must authenticate                   |
| HTTP+SSE (legacy)             | separate SSE and message endpoints                                                                                      | older servers         | deprecated in the spec (2025-03-26) |

**SSE is still there, inside Streamable HTTP.** Captured from an HTTP MCP endpoint built
during this course's development:

```
HTTP/1.1 200 OK
content-type: text/event-stream

event: message
data: {"result":{"protocolVersion":"2025-06-18", … },"jsonrpc":"2.0","id":1}
```

**This course uses stdio** (module 2): your own AI client starts the server as a child
process on your machine, so there is no port to open and nothing to authenticate. The trust
column above is why: an HTTP server that can write to your database would need
authentication before anyone else could reach it.

## Labs

These are reading labs. Do them once your agent has built the module 2 server
(`dist/mcp-server.js`, chapter 04), so you look at real traffic.

1. Send the raw `initialize` over stdio and read the reply:
   `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"1"}}}' | node dist/mcp-server.js`.
   Identify request, response and `id` matching. Where did the server's diagnostics go?
2. Classify: an unknown tool name, a rule violation (edit a `done` note), invalid JSON. Tool
   error or protocol error? Check against the server.
3. Why must a stdio server never write logs to stdout? (Chapter 04 says how the e2e test
   proves it does not.)
