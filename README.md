# Building Apps with AI Agents

A hands-on course: build a NestJS 12 service with AI coding agents, skills and templated code,
then turn it into an authenticated MCP server. Six modules, about 170 minutes of labs, with
the capstone as homework.

| path | what |
|---|---|
| [`docs/ai-agent-training/`](docs/ai-agent-training/README.md) | the course: start at [`00-OUTLINE.md`](docs/ai-agent-training/00-OUTLINE.md) (the six modules), then the chapters they point to |
| [`docs/ai-agent-training/slides/`](docs/ai-agent-training/slides/README.md) | the lecturer deck, `lab-companion.pptx` and `.md`, and its generator |
| [`boilerplate/nest-ai-starter/`](boilerplate/nest-ai-starter/README.md) | the service you build, with its skills, templates, lab checks (`pnpm lab NN`) and Postman collection |
| `docs/ai-agent-training/solutions/` | reference solutions for facilitators |
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
pnpm verify                # in a second terminal: 69 unit + 61 e2e tests
```
