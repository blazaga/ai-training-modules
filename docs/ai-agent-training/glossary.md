# Glossary

**Artefact.** The thing itself: an image on a node, a row in a table, a file at a ref, a test
that executed. Contrast with an _exit code_ or a status message, which is a claim about the
artefact.

**Charter.** The on-disk document every agent in a pool re-reads at the start of every turn.
It survives context compaction, while a first-turn prompt does not.

**Committer.** The one party allowed to push and merge. In this estate that is a single human.

**Compaction.** The harness summarising a long conversation to free up context. Anything that
existed only in the conversation is at risk; anything on disk is not.

**Context file.** A file the agent loads automatically at session start (`CLAUDE.md`). It holds
what is true everywhere in the repo.

**Coordinator.** The agent that reviews work, makes ship decisions and runs the periodic audit.
It is the only agent that may create or stop other agents.

**Existence is not reach.** A rule, fix or fact is in force only where it is read or executed.

**False green.** A pass signal produced by a run that did no work, or by a failure: exit 0 with
no tests run, `0 errors` from a killed process.

**Merge-base diff.** `git diff $(git merge-base A B) B`, which shows what B changed. Diffing
against A's moving tip instead makes A's newer commits look like B's deletions.

**Mutation check.** Revert the fix, confirm the new test fails, then restore the fix. This
shows the test actually tests the fix.

**Negative control.** A run that differs from the subject in exactly one variable, used to
test a proposed cause.

**OODA.** Observe → Orient → Decide → Act, run as a loop. It is the governing discipline in
this repo.

**PRE-SHIP.** A written deploy plan with measured evidence, submitted before any
infrastructure write and needing an explicit GO.

**Predicate.** The exact definition of what a number counts. It has to travel with the number.

**Probe that writes.** A "measurement" that changes the thing measured. Choose a target where
the change costs nothing.

**Reconcile against running.** Basing a deploy edit on what is actually running, not on a
stored config file that may be stale.

**Skill.** A packaged how-to (`SKILL.md` with name and description) that is loaded on demand
when its description matches the task.

**Subagent.** A separately-instructed agent with its own tool list, dispatched for one bounded
answer.

**Worktree.** A separate working directory on its own branch (`git worktree add`), used to
isolate one agent's batch from everyone else's.
