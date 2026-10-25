---
name: worklog-handoff
description: Record work in WORKLOG.md so the next agent or person can continue without the conversation. Use at the end of every working session, before stopping mid-task, and after any correction of an earlier claim.
---

# Leave a handoff a stranger can resume

Agents forget everything between sessions, and the conversation is not a record.
`WORKLOG.md` at the repo root is. Write it **before** you stop, not after you have been
asked.

## Entry format (newest first)

```markdown
## <YYYY-MM-DDTHH:MM:SS±HH:MM> - <one-line what>

- **Changed:** files/areas, and why (the requirement, not the diff).
- **Verified:** the commands run and their output lines (test counts, exit codes, controls).
- **Not done / open:** what is left, who or what it waits on, the exact next step.
- **Corrections:** any earlier entry or claim that turned out false, named and withdrawn.
```

## Rules

- **Timestamps come from a clock:** `date '+%Y-%m-%dT%H:%M:%S%:z'`. Never estimate one,
  and never write a bare date. A guessed time reads exactly like a measured one.
- **Numbers carry their predicate:** write `unit tests: 18 passed (3 suites)`, not `18`.
- **Withdraw, do not rewrite.** When an earlier entry was wrong, add a correction naming
  it, and mark the old text _withdrawn_ in place with the reason. Silent edits erase the
  lesson.
- **Test it:** could someone with only this file and the repo name the next concrete
  action? If not, the entry is not finished.
