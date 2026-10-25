# Principle P1 — Orientation: what you are actually working with

## Why it matters

The first instruction in this repo's own context file, the Quick Start, told every new
contributor, human or agent, to run:

```bash
corepack pnpm install && cp .env-sample .env && corepack pnpm local
```

No `.env-sample` existed at the repo root. The file is `.env-example`. Because the steps are
chained with `&&`, the copy failed and the dev server never started. The mistake sat in the
file every agent loads at the start of every session, and nobody caught it for weeks. Agents
followed it, hit the error and worked around it locally without fixing the source. Each
session started with no memory of the previous one, so the workaround never accumulated
into a fix.

That is the course in miniature. An agent does what the text says, fast and literally, and
it forgets. Any gap in the text costs you once per session, forever, until someone fixes
the text itself.

## The principle

> **An AI agent is a fast, literal, forgetful colleague. Design the workplace for that
> colleague, not for the one you wish you had.**

| trait              | consequence                                                       | design response                                                                     |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **fast**           | it will produce more change than you can review by eye            | gates that run without you: hooks, CI, typed boundaries                             |
| **literal**        | it follows the document you wrote, not the one you meant          | context files that are true, specific and testable                                  |
| **forgetful**      | every session, and every context compaction, starts close to zero | state lives in files, tickets and commits, never "in the conversation"              |
| **confident**      | a wrong answer reads exactly like a right one                     | verification that inspects the result itself, not what the agent says about it (P5) |
| **parallelisable** | you can run several at once                                       | roles, routing, one committer (P7)                                                  |

## The worked example: this repo

The DNA Forms portal is a production multi-tenant forms platform:

- **App:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind 3.4, shadcn/ui.
- **API:** tRPC (~75 routers) over a model layer and an ORM client (`dnaClient`).
- **AI features in the product itself:** Mastra agents (form assistant, form builder,
  knowledge stack, OCR, voice), CopilotKit chat UIs.
- **Estate:** environment branches `development → qa → staging → uat → production`, each
  built by GitLab CI into Docker images and deployed onto a Docker Swarm through Portainer.

It is also **built and run by agents**:

- A context file, `CLAUDE.md`, that every agent session loads. It runs to about 1,900 lines,
  and P2 covers why it got that long and what that costs.
- About 40 **skills**, each a packaged how-to (`skills/*/SKILL.md`), plus specialist
  **subagents** (`.claude/agents/*.md`).
- A standing **pool of agent threads** that triages the ticket queue, fixes bugs, has the fixes
  reviewed and prepares them for shipping (P7).
- **One human committer**, who pushes and merges everything. Agents end their work at a
  local commit.

## What "developing with agents" means in this course

The course does not cover prompt tricks. It covers the engineering system around the
agent:

1. **Context:** what the agent reads, and whether that text is true (P2–P3).
2. **Discipline:** how the agent decides what is true right now (P4).
3. **Verification:** how anyone, human or agent, knows the work happened (P5).
4. **Gates:** what stops a bad change regardless of who wrote it (P6).
5. **Orchestration:** how several agents share work without trampling each other (P7).
6. **Delivery:** getting from "the code is right" to "the user has it" (P8).
7. **Writing:** how agents and humans report facts so that the facts survive being quoted
   onward (P9).

## Anti-patterns to watch for from day one

- **"It said it ran the tests."** Ask for the test count per file, not the sentence.
- **Fixing it in chat.** A correction you make in the conversation is gone next session.
  Put it in the context file, the skill or the code.
- **One agent doing everything for hours.** Its context fills, it compacts, and it loses
  the thread. Split the roles (P7).
- **The agent holds the keys.** In this estate no agent pushes to the shared remote, and no
  agent touches production unless a human has named it.

## Exercises

1. **Run the Quick Start literally**, in a fresh clone of your own project. Does it work
   start to finish with no knowledge beyond the file? Record each step that needed
   knowledge the file does not contain.
   _Check:_ the dev server actually answers an HTTP request. A clean exit from the command
   does not count.
2. **Map the five traits onto your own project.** For each one, name one control you already
   have and one you lack.
3. **Find your own `.env-sample`.** Search your onboarding docs for a path, command or
   filename, and test that each one exists, for example with `test -f <path>`. Do not
   redirect errors to `/dev/null` while doing it. In this estate that redirect turned
   "the file does not exist" into "the pattern is not in the file", and the defect went
   unnoticed.
