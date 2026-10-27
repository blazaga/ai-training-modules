# Building Apps with AI Agents

A hands-on workshop: your AI coding agent builds a NestJS 12 service with skills and templated
code, then an MCP server that your Claude Desktop app connects to, to query and change the
data; you direct it and check every
step. Two modules, about 105 minutes. In each module the proctor gives an instruction (the
goal, where the requirements are, when it is done), the agent works out how, and a lab check
confirms it.

1. **Users and notes:** two REST resources (MVCs) on a SQLite file that ships seeded with
   faker data: 25 users, 200 notes (the TODO items), 120 shares.
2. **An MCP server on your data:** read and write tools over stdio; you connect it to Claude
   Desktop (`node scripts/claude-desktop-config.mjs` prints the entry) and ask it about the users
   and notes.

| path | what |
|---|---|
| [`docs/ai-agent-training/`](docs/ai-agent-training/README.md) | the course: start at [`00-OUTLINE.md`](docs/ai-agent-training/00-OUTLINE.md), then the chapters it points to |
| [`docs/ai-agent-training/slides/`](docs/ai-agent-training/slides/README.md) | the proctor deck with each module's instructions, `lab-companion.pptx` and `.md`, and its generator |
| [`docs/ai-agent-training/checkpoints/`](docs/ai-agent-training/checkpoints/README.md) | one patch per module: catch up to the start of the next module |
| branch [`modules-done`](../../tree/modules-done) | both modules as an AI agent built them from the instructions, one commit per module |
| [`boilerplate/nest-ai-starter/`](boilerplate/nest-ai-starter/README.md) | the base your agent builds on: the provided tables, the seeded `data/app.db`, skills, specs, templates, lab checks (`pnpm lab NN`) and a Postman collection |
| `tools/scan-sensitive.sh` | the check every commit passes: no credentials, internal hosts or customer data |

## Quick start

Node 24, pnpm through corepack; no database server (the database is one SQLite file, seeded).

```bash
cd boilerplate/nest-ai-starter
corepack enable            # refused? write `corepack pnpm` wherever the course says `pnpm`
pnpm install
cp .env.example .env       # port 3000 busy? set PORT= here
pnpm build && pnpm start   # http://localhost:3000
pnpm verify                # in a second terminal: 20 unit + 2 e2e tests on the base
pnpm db:seed               # any time: rebuild data/app.db with the original data
```
