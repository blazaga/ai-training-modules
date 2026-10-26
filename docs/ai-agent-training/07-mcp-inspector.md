# Chapter 07 — Using the server with the MCP Inspector

**You will:** drive the server with the **official MCP Inspector**, interactively and from
scripts. **Commit:** `course(ch07)`. The version is pinned to `2.12.0`, the version these
captures came from.

```bash
docker compose --profile inspector up -d inspector   # the web UI, over Streamable HTTP
docker compose run --rm dev pnpm build
docker compose run --rm dev pnpm mcp:inspect:cli --method tools/list   # the CLI, over stdio
```

## The web UI

In Docker it is the compose service `inspector` (chapter 00 explains how it is exposed: on your
machine's loopback only). It connects to the running app over **Streamable HTTP**, so it needs
a device's headers, exactly as any other client does (chapter 09).

1. Start it, then open the URL it prints (with its token):
   ```bash
   docker compose --profile inspector up -d inspector
   docker compose logs inspector   # http://localhost:6274/?MCP_INSPECTOR_API_TOKEN=…
   ```
2. **Add Servers** → **+ Add manually**: Server ID `nest-ai-starter`, Transport
   `streamable-http`, URL `http://app:3000/mcp` → **Add**. (The three example servers that
   are already listed can be ignored.)
3. On your server's card, **Settings** → **Custom Headers** → **+ Add Header** twice:
   `X-Access-Key-Id` and `X-Secret-Key`, with a device's values (the lab helper prints them).
   Close the dialog: header changes apply on the next connect.
4. Switch the card on: it shows **Connected**. Then **Tools** → pick a tool → **Execute Tool**.

**The URL it prints carries an API token** (`?MCP_INSPECTOR_API_TOKEN=…`): treat it as a
credential and never paste it into a ticket or chat. Captured startup (token redacted):

```
MCP Inspector Web is up and running at:
   http://localhost:6274/?MCP_INSPECTOR_API_TOKEN=<REDACTED>
```

Pick `create-note`: the form is generated from the zod-derived schema. Tools are listed as soon
as you connect, so there is no separate "list" step in 2.12.0.

With Node on your machine you can also run the UI against the **stdio** server, without Docker
and without device headers: `pnpm build && pnpm mcp:inspect`.

## The CLI: scriptable, and usable as a check

```bash
# discovery
npx @modelcontextprotocol/inspector@2.12.0 --cli node dist/mcp-stdio.js --method tools/list

# a call (tool arguments are key=value)
npx @modelcontextprotocol/inspector@2.12.0 --cli node dist/mcp-stdio.js \
  --method tools/call --tool-name create-note \
  --tool-arg title="Written by the Inspector" --tool-arg body="hello"
```

Captured `tools/list` excerpt: the schema the model sees, generated from zod:

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 1, "maxLength": 200 },
    "body": { "default": "", "type": "string", "maxLength": 10000 },
    "status": { "default": "draft", "type": "string", "enum": ["draft", "published"] },
    "tags": {
      "default": [],
      "maxItems": 10,
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z0-9-]{1,30}$" }
    }
  },
  "required": ["title"]
}
```

**A tool error makes the CLI exit 5** (measured: `get-note` with an unknown id returned
`isError: true` and exit code 5). So a CI step can assert a tool's behaviour with nothing
more than the exit code, and here, unlike most places in this course, the exit code is a
sound signal. It is produced by the tool's own `isError`, not by the absence of a crash.

For the HTTP server (chapters 08–09) the same CLI takes a URL and headers:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:3000/mcp \
  --method tools/call --tool-name whoami \
  --header "X-Access-Key-Id: AKID…" --header "X-Secret-Key: <SECRET>"
```

## Labs

1. Use the CLI in a script that fails the build if `create-note` stops rejecting
   `{title:'x', status:'published'}`.
2. Compare the UI's form for `create-note` with `specs/notes.md`. Is anything in the spec
   missing from what the model sees? (Look at R3–R5: why are they not in the schema?)
3. Find where the Inspector stores secrets on your machine (it prints the fallback it
   chose).
