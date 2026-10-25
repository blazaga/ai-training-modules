# Module 5 — Review gates and hooks: a guard checked only by its author is one check

## Why it matters

Agents produce change faster than humans can read it. The answer is not to read faster. It
is to have **gates that hold no matter who wrote the change**, plus a **second reader**
wherever a gate cannot reach.

Self-checked guards failed in this estate in four distinct ways:

- a disk-space guard that **passed when it could not read the disk** (an empty reading made
  the comparison false, so the transfer went ahead unchecked);
- count guards that "passed" because **nothing had changed**;
- a deploy validated against a build pipeline that had been **superseded 109 seconds
  earlier**;
- a list of images to update that **understated** what needed deploying, because it was
  derived from the wrong question.

Each guard was correct for the question its author had in mind. A second reader asking a
different question would have caught each one.

## The principle

> **Enforce mechanically where you can. Where you cannot, have a second party review the
> method, not just the outcome.**

## The gate stack in this repo

| layer              | where                               | what it enforces                                                                                    | bypassable?         |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------- |
| pre-commit         | `.husky/pre-commit` → `lint-staged` | `eslint --fix` + `prettier --write` on staged files; refuses the commit if dependencies are missing | yes (`--no-verify`) |
| pre-push           | `.husky/pre-push`                   | `prettier --check` + `eslint --quiet` on the **push range**; verifies, does not fix                 | yes (`--no-verify`) |
| CI                 | `.gitlab-ci.yml` `typecheck` job    | full typecheck on every branch, `allow_failure: false`                                              | no                  |
| review             | coordinator agent / human           | the diff and **the verification evidence**                                                          | —                   |
| deploy plan review | PRE-SHIP plan file → GO / HOLD      | authority, freshness, tag list, reconciliation, rollback                                            | —                   |

### Read the hooks: they explain their own design

`.husky/pre-commit` documents its limits instead of hiding them:

> `git commit --no-verify` skips this hook entirely — no local hook can be unbypassable,
> which is why `typecheck` stays a CI job rather than moving here.

It also **fails loudly when dependencies are missing**. An earlier version exited with a bare
`code 127` that read like a lint failure and sent two agents hunting a non-existent lint bug.

`.husky/pre-push` explains why it **verifies rather than fixes**. By the time you push, the
commits already exist, so rewriting files would leave the working tree disagreeing with what
is being pushed. It also checks only the push range, because _"a hook people wait on is a
hook people bypass."_ The measured cost was 1.5 s for 40 files against about 100 s for the
whole tree.

### Read the CI gate: both halves are needed

From the `typecheck` job comment in `.gitlab-ci.yml`:

> It is `allow_failure: false` and NOT branch-restricted, and both halves are required for it
> to be a gate. Restricted to feature branches it would enforce nothing on the branches that
> ship; left `allow_failure: true` it would report into a pipeline that still reads
> `success`.

It was also introduced **on evidence**. Before it was enforced, the team measured that
product code was already clean, so the gate was known to be satisfiable and would not just
block everyone on day one.

## Reviewing agent work

In the orchestration (module 6), a worker agent finishes with:

1. a local commit on its own branch,
2. the diff,
3. **verification output**: per-file test counts, typecheck with a planted-error control,
   and a mutation check showing the new test fails without the fix,
4. a short mail to the coordinator: `REVIEW <keys>`, branch, sha, one-line verdict, and a
   pointer to the details.

The reviewer **reads the diff and the verification itself** and decides: ship, rework or
park. Rework mail names the specific defect.

### Reviewer checklist (drawn from real misses)

- Diff **against the merge-base**, never against the tip. A moved tip makes your own commits
  look like deletions. "You touched a file you shouldn't have" is the review finding most
  likely to be an artefact of the diff.
- Does each test **fail without the fix**? Was it run, and how many tests ran per file?
- Does every new comment that claims an impossibility cite a measurement?
- Is a fix to a **cross-context** path (worktrees, CI vs local) tested in the context it was
  written for? A config fix that was correct in the main checkout was inert in the worktrees
  it targeted, and every test available where it was written passed.
- **Method over outcome:** a correct result reached by a check that could not discriminate is
  still a HOLD on the method. A method that was right by luck will fire again, on different
  data, with the same confidence.

## Running operations get no review, so review them

A proposed operation has an author, a reviewer and a moment of decision. **A scheduled job
has none of those, and its risk is incurred again on every run.** A cleanup job running every
30 minutes was reviewed once, when it was safe. Later, production workloads moved onto that
node and the same job could delete their images. Nothing in the job had changed, so no diff
ever triggered a review.

> Review recurring jobs when the **environment** changes, not only when the job changes.

## Exercises

1. **Bypass inventory.** List every gate in your pipeline and how each can be bypassed.
   Anything only a local hook enforces needs a CI counterpart.
2. **Fail-open hunt.** Find a guard in your scripts that reads a value (disk, count, status)
   and check what it does when the read **fails**. Make it fail closed and say so loudly.
3. **Review a past agent PR with the checklist above.** Record which items the original
   review skipped.
