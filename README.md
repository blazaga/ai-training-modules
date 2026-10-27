# Building Apps with AI Agents

A hands-on workshop: your AI coding agent builds a NestJS 12 service with skills and templated
code, then turns it into an authenticated MCP server; you direct it and check every step. Six
modules, about 185 minutes, with the capstone as homework. In each module the proctor gives an
instruction (the goal, where the requirements are, when it is done), the agent works out how and
builds the next layer, and a lab check confirms it.

| path | what |
|---|---|
| [`docs/ai-agent-training/`](docs/ai-agent-training/README.md) | the course: start at [`00-OUTLINE.md`](docs/ai-agent-training/00-OUTLINE.md) (the six modules), then the chapters they point to |
| [`docs/ai-agent-training/slides/`](docs/ai-agent-training/slides/README.md) | the proctor deck with each module's instructions, `lab-companion.pptx` and `.md`, and its generator |
| [`docs/ai-agent-training/checkpoints/`](docs/ai-agent-training/checkpoints/README.md) | one patch per module: catch up to the start of any module |
| [`boilerplate/nest-ai-starter/`](boilerplate/nest-ai-starter/README.md) | the base your agent builds on: setup, `notes` and `users`, with its skills, specs, templates, lab checks (`pnpm lab NN`) and Postman collection |
| `tools/scan-sensitive.sh` | the check every commit passes: no credentials, internal hosts or customer data |

## Quick start

Node 24, pnpm through corepack; no database server (the database is one SQLite file).

```bash
cd boilerplate/nest-ai-starter
corepack enable            # refused? write `corepack pnpm` wherever the course says `pnpm`
pnpm install
cp .env.example .env       # port 3000 busy? set PORT= here
pnpm build && pnpm db:migrate
pnpm start                 # http://localhost:3000
pnpm verify                # in a second terminal: 40 unit + 26 e2e tests on the base
```
