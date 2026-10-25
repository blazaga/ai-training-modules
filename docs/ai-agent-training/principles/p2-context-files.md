# Principle P2 — Context files: the agent knows only what it reads

## Why it matters

Three things in this estate were written down, correct, and **had no effect**:

| the thing                               | where it was written                 | where it was needed                                                                                |
| --------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| a fix for a CI job that failed silently | the `development` branch             | the `qa`, `staging` and `uat` branches, whose pipelines kept running the broken version            |
| four local coding-rule overrides        | a copy of a skill on the workstation | the repository, which shipped its own copy of that skill, so the workstation copy was never loaded |
| a rule for an autonomous loop           | the loop's private state file        | every other agent session, none of which read that file                                            |

None of the three was wrong. Each was out of reach of the code or session it was meant to
govern, and each looked settled because it had been written down somewhere.

## The principle

> **Existence is not reach. A rule, fix or fact is in force only where it is read.**

For agents this is literal. A session loads a specific set of files, such as the repo
`CLAUDE.md`, the user's global instructions and a memory index. Anything outside that set
does not exist for the agent unless something it does read points to it.

You can see this in this course's own worktree. The corrected Quick Start (`.env-example`)
existed only as an uncommitted edit in the shared checkout. The branch this course was cut
from still says `.env-sample`. An agent started on that branch gets the old, broken
instruction.

## How this repo does it

### Layers of context

| layer           | file                                                | scope                                     |
| --------------- | --------------------------------------------------- | ----------------------------------------- |
| global          | `~/.claude/CLAUDE.md` (user's private instructions) | every project on the workstation          |
| project         | `CLAUDE.md` at the repo root                        | everyone working in this repo             |
| memory          | `MEMORY.md` index + one file per fact               | this user × this project, across sessions |
| canonical store | a project knowledge server (docs, skills, memories) | shared, searchable, versioned             |
| per-module      | `WORKLOG.md` inside self-contained modules          | whoever touches that module next          |

The rule for resolving conflicts is written into the files themselves: _"Where a repository's
own CLAUDE.md disagrees with the skill, that repository's file wins."_ Make your precedence
order explicit in the same way, because otherwise an agent has to guess it.

### What a good context file contains

Look at the top of this repo's `CLAUDE.md`:

- **Quick Start and Commands.** These are exact, copy-pasteable and tested. Notice the warning
  that `pnpm` is not on `PATH` and that you must use `corepack pnpm`. Without it, every agent
  loses a few minutes to the same failure.
- **Tech stack with version traps.** _"Tailwind CSS 3.4 — v3, NOT v4. The `tailwindcss` skill
  is written for v4; applying it here emits code this repo cannot compile."_ This sentence
  stops a capable agent from doing the wrong thing confidently.
- **Conventions.** Naming, imports, soft delete (`tombstone: 1`, `status: 'Archived'`, never a
  hard delete) and UI rules (no nested cards, a `data-testid` on every interactive control).
- **Patterns with code.** The exact `dnaClient` call shapes, including a known trap: _"UPSERT
  (id goes in params, NOT mutation.id)"_.
- **Where things live.** The URL patterns and the three steps for wiring up a menu entry.

### What it grew into, and what that costs

The file is now about 1,900 lines. Most of the growth is lessons learned from incidents.
Many of those are valuable, but a long file has costs:

- **Reach inside the file.** One instrument (how to check whether two branches will merge)
  was documented about 700 lines below the place where the question naturally comes up.
  Two agents reasoned without it and published a conflict that did not exist. A file can
  contain the answer and still not deliver it.
- **Counts that rot.** A heading read "FOUR QUESTIONS" above a table someone had grown to five
  rows. Name a collection by what it holds, not by how many items it has.
- **Quoted values that rot.** The file quoted a date threshold from a config that a human
  later changed. An agent that compared the date against the quoted value would have shut
  down a live process. The fix was to **quote the form ("is >= …") and never the value**,
  and to point to where the live value lives.

## Practical rules for your own context files

1. **Commands must be runnable as written.** Test them in a fresh clone.
2. **State traps next to the thing they trap.** Put the Tailwind warning in the Tech Stack
   section, not in a "gotchas" appendix.
3. **Point to live values instead of copying them.** Write "read the gate from `<file>`", not
   "the gate is 2026-10-26".
4. **Date every measurement, with its time zone.** `2026-10-15T14:00+08:00`, never a bare date.
   A bare date cannot be converted later by anyone.
5. **Fix false statements as you find them.** A comment or doc line you can show is false is a
   defect. Correct it and record what it used to say.
6. **Index the question, not just the answer.** If people ask "will this merge?", the
   instrument for that belongs where people look when they ask it.
7. **Keep it reviewable.** Prefer a short project file that links to runbooks and skills over a
   file that holds everything. Load detail when it is needed (P3).

## Memory: the forgetfulness fix, and its own traps

The memory system stores **one fact per file** with a one-line index entry. It works because it
is cheap to load and easy to correct. Lessons from this estate:

- **Never store what the repo already records** (code structure, git history). Store what is
  _not_ derivable: decisions, preferences, gotchas.
- **An index that grows past its load limit truncates silently.** The tail entries are simply
  not loaded. Keep index lines short.
- **Memories go stale.** A memory that names a file, function or flag must be re-checked
  before anyone acts on it.

## Exercises

1. **Audit for reach.** List every place a rule for your project is written (README, wiki,
   context file, CI comments, chat). For each, write down who or what actually reads it.
   Anything that nothing reads is not in force.
2. **Find a quoted value.** Search your context files for a literal version number, date, port
   or count that is copied from elsewhere. Rewrite it to point at its source.
3. **The fresh-clone test.** Start an agent on a fresh clone with only your context file and
   ask it to start the app. Every question it asks, or every wrong turn it takes, is a missing
   line in the file.
   _Check:_ the app answers a request. "The command exited 0" is not enough.
