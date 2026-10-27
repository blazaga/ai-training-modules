# Building Apps with AI Agents

Your AI coding agent builds a NestJS 12 service with skills and templated code, then gives your
own AI client an MCP server on its data; you direct it and check every step. The service starts
in `boilerplate/nest-ai-starter/` with a seeded SQLite database (users, notes, shares), and
grows one layer per module.

The course runs in two modules; start with the [outline](00-OUTLINE.md), which maps each
module to the chapters below. The proctor deck, with each module's instructions for your
agent, is in [`slides/`](slides/README.md). Fell behind? [`checkpoints/`](checkpoints/README.md)
gets you to the start of the next module.

| ch  |                                                                            |
| --- | -------------------------------------------------------------------------- |
| 00  | [Setup: Node, pnpm and one seeded SQLite file](00-setup.md)                |
| 01  | [Starting from the CLI and templates](01-cli-and-templates.md)             |
| 02  | [Users and notes on the provided tables](02-users-and-notes.md)            |
| 03  | [The Model Context Protocol: envelopes and transports](03-mcp-concepts.md) |
| 04  | [An MCP server on the database](04-mcp-server-on-sqlite.md)                |

Principles P1–P9 (working with agents) are in [`principles/`](principles/). Also:
[Glossary](glossary.md) · [Facilitator notes](answers.md).

```bash
cd boilerplate/nest-ai-starter
corepack enable && pnpm install && cp .env.example .env
pnpm build && pnpm start                      # seeded SQLite file data/app.db, app on :3000
pnpm verify                                   # typecheck, lint, format, markers, migrations, unit, e2e
```
