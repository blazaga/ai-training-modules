# Building Apps with AI Agents: Skills, Templates, NestJS and MCP

**Audience:** developers who want to build production services _with_ AI coding agents,
and keep them consistent, tested and safe.

**How it works:** you build one real service, `boilerplate/nest-ai-starter/` (NestJS 12),
chapter by chapter. Every chapter is a commit (`git log --grep 'course(chNN)'`), so you can
check out any step. **Everything runs in Docker** (chapter 00): Postgres, Redis, the
app and the tools; no local Node is required. Repeatable work is done by tools (nest-cli, templates, a verify gate);
judgement is done by an agent inside marked regions, guided by skills in
`.claude/skills/`. Every claim in the chapters was measured on this code, and the traps we
hit are part of the material.

## The track

| ch  | chapter                                                                   | you build                                                                             | key lesson                                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 00  | [Everything in Docker](00-docker-setup.md)                                | the compose stack (Postgres, Redis, migrate, app) and the `dev` toolbox               | no local Node: every `pnpm X` runs as `docker compose run --rm dev pnpm X` |
| 01  | [Starting from the CLI and templates](01-cli-and-templates.md)            | Nest 12 project, `notes` via generate → template → fill → verify                      | tools for repeatable work, agents only inside markers                      |
| 02  | [A users table with drizzle and zod](02-users-drizzle-zod.md)             | database module, drizzle storage variant, `users` (controller + service + unit tests) | migrations are checked by the ledger; table/migration drift                |
| 03  | [Auth: BasicAuth middleware, then Passport](03-auth-basic-to-passport.md) | hand-written middleware → Passport strategy + global guard                            | secure by default; one 401 for every failure                               |
| 04  | [Devices: credentials, then merged with users](04-devices.md)             | device credentials (issue/rotate/activate/archive), ownership                         | server-issued, hash-only secrets; 404 not 403                              |
| 05  | [The Model Context Protocol](05-mcp-concepts.md)                          | — (concepts from captured traffic)                                                    | JSON-RPC envelopes; stdio vs Streamable HTTP; SSE inside HTTP              |
| 06  | [Your first MCP controller](06-first-mcp-controller.md)                   | `@rekog/mcp-nest` tools over existing services; stdio entrypoint                      | reuse the REST schema; test stdout as raw bytes                            |
| 07  | [Using the MCP Inspector](07-mcp-inspector.md)                            | UI + scripted CLI checks                                                              | the CLI's exit code as a CI check                                          |
| 08  | [From stdio to Streamable HTTP](08-stdio-to-streamable-http.md)           | MCP over HTTP inside the app; transport configuration                                 | defaults matter; `MCP_ALLOWED_HOSTS`; `fetch` can't send `Host`            |
| 09  | [MCP auth with device access keys](09-mcp-device-auth.md)                 | `X-Access-Key-Id` / `X-Secret-Key` on `/mcp`, `whoami`                                | authenticate at the transport; order is load-bearing                       |
| 10  | [Capstone](10-capstone.md)                                                | device-scoped notes through every layer                                               | evidence, not claims                                                       |

## Principles (reference, linked from the chapters)

How to work with agents at all: drawn from running a production estate with them.

|     | principle                                                                          |
| --- | ---------------------------------------------------------------------------------- |
| P1  | [Orientation: a fast, literal, forgetful colleague](principles/p1-orientation.md)  |
| P2  | [Context files: existence is not reach](principles/p2-context-files.md)            |
| P3  | [Skills and specialist agents](principles/p3-skills-and-agents.md)                 |
| P4  | [The OODA loop: measure, don't recall](principles/p4-ooda.md)                      |
| P5  | [Verification: ask the artefact, not the exit code](principles/p5-verification.md) |
| P6  | [Review gates and hooks](principles/p6-review-gates.md)                            |
| P7  | [Orchestrating many agents](principles/p7-orchestration.md)                        |
| P8  | [Shipping safely](principles/p8-shipping.md)                                       |
| P9  | [Writing facts that survive being quoted](principles/p9-writing.md)                |

Plus: [Glossary](glossary.md) · [Facilitator notes](answers.md) · [WORKLOG](WORKLOG.md)

## Ground rules for the material

- No credentials, tokens, internal hosts or customer data; placeholders such as `<SECRET>`.
  Every commit passes `tools/scan-sensitive.sh`.
- Incidents from the estate appear only as anonymised lessons.
- Every chapter ends with labs that are checked by evidence, never by "it worked".
