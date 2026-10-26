# Building Apps with AI Agents

Build a NestJS 12 service with AI agents, skills and templated code, then turn it into an
authenticated **MCP server**. The service is `boilerplate/nest-ai-starter/`.

The course runs in six modules; start with the [outline](00-OUTLINE.md), which maps each
module to the chapters below. The lecturer deck is in [`slides/`](slides/README.md).

| ch  |                                                                            |
| --- | -------------------------------------------------------------------------- |
| 00  | [Setup: Node, pnpm and one SQLite file](00-setup.md)                       |
| 01  | [Starting from the CLI and templates](01-cli-and-templates.md)             |
| 02  | [A users table with drizzle and zod](02-users-drizzle-zod.md)              |
| 03  | [Auth: BasicAuth middleware, then Passport](03-auth-basic-to-passport.md)  |
| 04  | [Devices: credentials, then merged with users](04-devices.md)              |
| 05  | [The Model Context Protocol: envelopes and transports](05-mcp-concepts.md) |
| 06  | [Your first MCP controller](06-first-mcp-controller.md)                    |
| 07  | [Using the MCP Inspector](07-mcp-inspector.md)                             |
| 08  | [From stdio to Streamable HTTP](08-stdio-to-streamable-http.md)            |
| 09  | [MCP auth with device access keys](09-mcp-device-auth.md)                  |
| 10  | [Capstone](10-capstone.md)                                                 |

Principles P1–P9 (working with agents) are in [`principles/`](principles/). Also:
[Glossary](glossary.md) · [Facilitator notes](answers.md) · [WORKLOG](WORKLOG.md).

```bash
cd boilerplate/nest-ai-starter
corepack enable && pnpm install && cp .env.example .env
pnpm build && pnpm db:migrate && pnpm start   # SQLite file data/app.db, app on :3000
pnpm verify                                   # typecheck, lint, format, markers, migrations, unit, e2e
```
