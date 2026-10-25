# Building Software with AI Agents — a course built on a real codebase

**Audience:** developers and tech leads who already write code and now want to ship a
production app _with_ AI coding agents (Claude Code and similar), not just autocomplete.

**Worked example:** this repository — the DNA Forms portal (Next.js 16 App Router, tRPC,
Mastra agents, PostgreSQL, a Docker Swarm estate with qa/staging/uat/production). It is
built and operated day to day by a team of humans plus a standing pool of AI agent threads.
Everything in this course is drawn from how that actually works, including where it broke.

**Ground rules for the material**

- Every incident is an _anonymised lesson_: no credentials, tokens, internal hosts/IPs,
  webhook URLs, account ids or customer data. Placeholders look like `<REGISTRY>`, `<TOKEN>`.
- Every claim about the repo points at a file you can open (`CLAUDE.md`, `.husky/pre-push`,
  `.gitlab-ci.yml`, `.claude/agents/*.md`, `skills/*/SKILL.md`).
- Each module ends with **exercises** you can run against this repo or your own.

## Course map

| #   | module                                                  | the one idea                                                                     | repo artefacts used                                                     |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | [Orientation](01-orientation.md)                        | an agent is a fast, literal, forgetful colleague — design the workplace for that | repo tour, `CLAUDE.md` Quick Start                                      |
| 2   | [Context files](02-context-files.md)                    | the agent knows only what it reads; _existence is not reach_                     | `CLAUDE.md`, memory index, project-mcp mirror                           |
| 3   | [Skills and specialist agents](03-skills-and-agents.md) | package repeatable know-how so it loads on demand                                | `skills/*/SKILL.md`, `.claude/agents/*.md`                              |
| 4   | [The OODA loop for agents](04-ooda.md)                  | observe → orient → decide → act, and measure instead of recalling                | `CLAUDE.md` OODA section                                                |
| 5   | [Verification discipline](05-verification.md)           | _ask the artefact, not the exit code_                                            | the "what reported / what was true" table, vitest/tsc/CI false greens   |
| 6   | [Review gates and hooks](06-review-gates.md)            | a guard checked only by its author is one check, not two                         | `.husky/pre-commit`, `.husky/pre-push`, CI `typecheck`, PRE-SHIP review |
| 7   | [Orchestrating many agents](07-orchestration.md)        | roles, routing, state files, one committer                                       | v84 triage orchestration (anonymised)                                   |
| 8   | [Shipping safely](08-shipping.md)                       | branch ≠ built ≠ delivered ≠ deployed                                            | release train, QA tag-bump procedure, reconcile-against-running         |
| 9   | [Writing for humans and tools](09-writing.md)           | state the predicate, the window and the frame                                    | timestamps, Jira rendering, "a number travels, its predicate does not"  |
| 10  | [Capstone](10-capstone.md)                              | ship a small feature end-to-end with agents, with evidence                       | a scoped feature in this repo                                           |

Plus: [Glossary](glossary.md) · [Exercise answer notes](answers.md) · [WORKLOG](WORKLOG.md)

## Module skeleton (every module follows it)

1. **Why it matters** — one concrete failure from the estate, anonymised.
2. **The principle** — stated in one sentence you can put on a wall.
3. **How this repo does it** — the actual files, quoted briefly.
4. **Anti-patterns** — what it looks like when it goes wrong, and the tell.
5. **Exercises** — hands-on, each with a check that does not rely on an exit code.

## Planned worked examples (from this repo)

- **The false green catalogue:** `vitest` reporting "no failures" with `Errors 1`; `tsc` printing
  `0 errors` from an OOM-killed process; a CI transfer job exiting 0 having shipped nothing;
  a pipeline status `success` hiding a 77-minute wedged retry.
- **Context-file rot:** a Quick Start that pointed at a file that did not exist; a quoted gate
  value that went stale and nearly made an agent shut down a live loop ("quote the form, never
  the value").
- **Skills that lived where they were not loaded:** local overrides silently inert for months.
- **Orchestration evolution:** one looping agent → a pickup/router + general + deep + shipper
  pool, and the specific failure each version answered.
- **Shipping:** a carried-over bump list that would have pointed live services at tags never
  built; reconciling against _running_ services, not the stored stack file.
- **Writes disguised as probes:** testing a tool's input format against a live field and
  destroying its content.

## Delivery formats

Markdown in-repo first (this tree). Later, on request: slide deck, a one-page cheat sheet,
and a facilitator guide with timings (~1 day workshop, or 10 × 45-min sessions).
