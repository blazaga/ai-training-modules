# Chapter 06 — Your first MCP controller (`@rekog/mcp-nest`)

**You will:** expose existing services as MCP tools and run them over stdio.
**Commit:** `course(ch06)`. **Files:** `src/mcp/notes.tools.ts`, `src/mcp/tool-result.ts`,
`src/mcp/mcp-tools.module.ts`, `src/mcp-stdio.ts`.

## How `@rekog/mcp-nest` 2.x is shaped (read from the package, 2.0.8)

- There is **no `McpModule`** any more. MCP is a **NestJS microservice transport
  strategy** (`McpStrategy`). Tools are methods on `@McpController()` classes, so Nest
  pipes, guards and filters apply to them.
- Peers: the MCP SDK v2 split packages (`@modelcontextprotocol/server` 2.4.0, `node`
  2.1.2, `core` 2.4.0, all stable) and `@nestjs/microservices`. It supports Nest 12, and
  nothing needed an install script.

```bash
pnpm add -E @rekog/mcp-nest@2.0.8 @modelcontextprotocol/server@2.4.0 \
  @modelcontextprotocol/node@2.1.2 @modelcontextprotocol/core@2.4.0 @nestjs/microservices@12.2.0
```

## Tools are thin adapters over services you already have

```ts
@McpController()
export class NotesTools {
  constructor(private readonly notes: NotesService) {}

  @Tool({
    name: 'create-note',
    description: 'Create a note. status is draft or published; a published note needs a body.',
    parameters: CreateNoteSchema, // the SAME zod schema as POST /api/v1/notes
  })
  createNote(@Payload() input: z.output<typeof CreateNoteSchema>) {
    return runTool(() => this.notes.create(input));
  }
}
```

- **Reuse the REST schema.** The client receives a JSON Schema generated from it, and
  mcp-nest validates arguments with it. Measured: `create-note` with
  `{ title: 'x', status: 'published' }` is refused with _"a published note needs a non-empty
  body"_, which is cross-field rule R2 from chapter 01, enforced for MCP at no extra cost.
- **`runTool()` turns a `DomainError` into a tool error** (`isError: true`), which the model
  can read. Anything else propagates as a real failure.
- **Descriptions are prompts.** The model reads them to decide what to call; write the
  rules there.

## The stdio entrypoint

```ts
const app = await NestFactory.createMicroservice(McpStdioModule, {
  strategy: new McpStrategy({ ...MCP_SERVER_INFO, transports: [new StdioTransport()] }),
  logger: false, // stdout belongs to the protocol
});
await app.listen();
```

```bash
pnpm build && pnpm mcp:stdio      # node dist/mcp-stdio.js
```

## Test it as a client would (not by reading logs)

`test/mcp-stdio.e2e-spec.ts` spawns the **built** server with the MCP SDK v2 client:
`initialize` → `tools/list` → `tools/call`. The e2e global setup **builds fresh and fails
on a stale `dist/`**, because a spawned binary from yesterday would test yesterday's
code.

### The stdout measurement (it corrected our own comment)

We first wrote "one stray `console.log` corrupts the stream". Then we measured it:

| stray output on stdout | SDK v2 client                                         |
| ---------------------- | ----------------------------------------------------- |
| a plain text line      | **skipped silently**: no error, the call succeeds     |
| a JSON-shaped line     | reported as a protocol error; the call still succeeds |

The line **does** pollute the protocol stream. _This_ client tolerates it, stricter clients
may not, and **no client-driven test can catch it**. So the suite also reads **raw stdout**
and asserts every line is a JSON-RPC 2.0 message. That test fails on the `console.log`
mutant; the six client-based tests did not.

## Verify

e2e `Tests 54 passed`, including stdio: identity, three tools, schema `required:
["title"]`, `NOT_FOUND` tool error, R2 rejection, and raw stdout.

## Labs

Lab 1 is checked: `pnpm lab 06`. The contract (parameters, and the tool-error text
for each failure) is in `boilerplate/nest-ai-starter/test/labs/README.md`.

1. Add a `publish-note` tool. Which rule from chapter 01 must it respect, and where is it
   enforced?
2. Add a tool whose description is vague, and one whose description states the rules. Ask
   an agent to use each. What changes?
3. Plant `console.log(JSON.stringify({debug:true}))` in a tool. Which test fails and which
   do not?
