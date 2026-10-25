# Principle P3 — Skills and specialist agents: package the know-how

## Why it matters

A context file holds what is true everywhere in the repo. Most know-how only matters for one
kind of task: wiring a tRPC router, adding a portal menu, debugging content that renders in
the wrong format. If all of it lives in the context file, the file becomes unreadable. If none
of it is written down, every agent rediscovers it from scratch.

## The principle

> **Put repeatable know-how in a skill that is loaded when it is relevant, and put
> repeatable roles in a specialist agent. Then make sure both are actually reachable.**

## Skills

A skill is a folder with a `SKILL.md` that has YAML frontmatter, a `name` and a `description`.
The **description is the trigger**. The agent sees the descriptions of all available skills
and decides from them which to load.

From this repo, `skills/trpc-setup/SKILL.md`:

```markdown
---
name: 'trpc-setup'
description: 'Guides tRPC router/procedure creation. Invoke when adding a new API procedure or wiring a new router.'
---

# tRPC Procedures

## Setup Locations

- Router definition: `src/server/api/trpc.ts`
- Individual routers: `src/server/api/routers/*`
- Router registration: `src/server/api/root.ts`
  ...
```

A good description says **what the skill is and when to use it**, in the words a task would
use ("adding a new API procedure"). If the description is vague, the skill never gets loaded.

The repo has about 40 project skills: `create-portal-menu`, `dna-orm-patterns`,
`form-builder`, `platform-components`, `side-drawer`, `using-models` and others. The
`CLAUDE.md` gives a shortcut table mapping each kind of task to the skills to start with.

### Skill traps measured here

- **A skill written for a different version.** The `tailwindcss` skill targets Tailwind v4,
  and this repo uses v3.4. The context file carries the warning, because the skill cannot
  know which repo it is loaded into.
- **A local mirror that is incomplete.** Skills are canonical in a shared project knowledge
  store, and the local `skills/` directory is a partial mirror. Several skills exist only in
  the store. _Never read a missing local directory as "no such skill"._
- **Overrides that lived in a copy nobody loaded.** Four local rules were added to a
  workstation copy of a coding-guidelines skill. The repo shipped its own copy, which took
  precedence, so the overrides silently applied nowhere for months. They were moved into the
  repo's `CLAUDE.md`, where they are actually read.

## Specialist agents (subagents)

A subagent is a separate agent with its own instructions and **its own tool list**, dispatched
for a bounded job. It returns one answer, so the main conversation receives the conclusion
instead of every file the subagent read. This repo ships several, in `.claude/agents/*.md`:

| agent                              | job                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `markdown-render-debugger`         | content that renders in the wrong format (literal `**`, escaped HTML, raw JSON) |
| `grid-sort-validator`              | audit a data grid's sort pipeline end to end                                    |
| `form-parallel-slot-builder`       | make one form reusable as both a wizard step and a record tab                   |
| `form-composer-builder`            | continue a large refactor task by task, using a WORKLOG                         |
| two infrastructure troubleshooters | diagnose a host read-only, and propose any write before making it               |

### What makes these good

Look at `markdown-render-debugger.md`. Its first step is **"find the prior fixes FIRST. Do not
skip this."** It gives the exact `git log -S` and `--grep` commands, then three questions to
answer before touching code: is this a regression, is it a surface that never received the
fix, or is it genuinely new? It encodes the team's hard-won knowledge that this bug has been
fixed several times in different places.

Other patterns worth copying:

- **Read-only by default, propose before writing.** The troubleshooters diagnose freely and
  must propose any restart, prune or write before doing it, unless the request explicitly
  authorises it.
- **Resume from a WORKLOG.** `form-composer-builder` reads the plan and the module's
  `WORKLOG.md` first, and updates it before finishing, so the next agent can continue.
- **Stop at the human gate.** The release agent runs routine promotions, but anything that
  touches production it **prepares and then stops** for explicit human confirmation.

### Trap: match the agent to the tools, not the name

The infrastructure troubleshooters carry only `Bash`, `Read`, `Grep` and `Glob`, with no
container-management, SSH or CI integrations. Sent a job that needed one of those, such an
agent reports the task impossible when the answer was one tool call away. **Check the tool
list before dispatching.**

### Trap: separate what an agent read from what it concluded

A subagent once reported that two CI runners "report the same system ID, so they are one
machine, not two". The **reading** was correct. The **inference** was false: the hostnames
and filesystems differed, and a shared ID only meant a copied config directory. The two
travelled together in one sentence and nearly weakened a valid disk warning. When you relay a
subagent's result, write "the agent read X" and "the agent concluded Y, unverified" as two
separate claims.

## Exercises

1. **Write a skill** for one task your team repeats, such as "add an API endpoint". Give it a
   description that names the task the way a ticket would. _Check:_ start a fresh agent
   session, describe the task without naming the skill, and see whether the skill gets loaded.
2. **Write a specialist agent** for one class of recurring bug. Make step 1 "find prior fixes
   in history" with exact commands. _Check:_ run it on a past bug whose fix you know, and see
   whether it finds that fix.
3. **Version audit.** For each skill you use, check which library versions it assumes against
   your lockfile. Write a warning into your context file for every mismatch.
