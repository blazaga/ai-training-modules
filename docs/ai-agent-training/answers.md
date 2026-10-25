# Exercise answer notes (for facilitators)

These are not model answers, since most exercises run against the participant's own project.
They describe what a good submission shows and the usual ways a submission goes wrong.

## Module 1

- **Ex 1:** a good submission names steps where the doc assumed knowledge, such as a missing
  env file, a tool not on `PATH` or a service that must already be running. Common miss:
  reporting "it worked" because the command exited 0 while the server never answered.
- **Ex 3:** watch for `2>/dev/null` and `|| true` in the participant's own checks. They turn
  "path missing" into "pattern absent".

## Module 2

- **Ex 1:** expect at least one rule that is read by nothing. Typical cases are CI comments
  about local practice, wiki pages, and chat decisions.
- **Ex 2:** the rewritten line should name the file or command where the live value can be
  read.

## Module 3

- **Ex 1:** if the skill did not load, the description almost always uses the author's
  vocabulary instead of the task's.
- **Ex 2:** a good agent definition has a restricted tool list and a "propose before writing"
  rule.

## Module 4

- **Ex 1:** cherry-pick case: `git merge-base --is-ancestor <orig-sha> <branch>` exits 1, while
  `git show <branch>:<file>` contains the change.
- **Ex 2:** the control must differ in one variable only. Reject controls that also change the
  environment, the data or the version.

## Module 5

- **Ex 1:** many runners exit 0 when a filter matches nothing. Good wrappers parse the "N
  passed" line and fail when N is 0.
- **Ex 2:** check for `allow_failure: true` and branch restrictions. Either one makes the gate
  advisory.
- **Ex 4:** `set -o pipefail` changes the behaviour of the whole script. Discuss the
  trade-off against `PIPESTATUS`.

## Module 6

- **Ex 2:** typical fail-open shapes: `X=$(cmd) || true` followed by `[ -n "$X" ] && [ "$X" -lt N ]`,
  where an empty value skips the guard.

## Module 7

- **Ex 2:** the test is whether a fresh agent given only the state file can name the next
  concrete action, who it is waiting on, and what was already verified.

## Module 8

- **Ex 3:** any difference between the stored and running tag for a service is a regression
  waiting to be redeployed. A good submission fixes the stored config, not only the
  spreadsheet.

## Module 9

- **Ex 2:** a bare date is recoverable only if some other artefact (a commit with an offset, a
  log line) pins it down. Most are not recoverable, which is the lesson.
