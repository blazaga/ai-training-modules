# Module 9 — Capstone: ship a small feature end to end, with evidence

## Goal

Use agents to deliver one small, real change to this repo or your own, through every stage
covered in the course. The grade is the **evidence package**, not the feature.

## Suggested feature (this repo)

Add a read-only "About" panel to a portal page that shows the app version from `/api/config`.
It is small, visible, testable, and touches the conventions: a server component first, a
`data-testid` on every control, `~/` imports and Tailwind v3.

Pick something of the same size if you use your own project.

## Steps and required evidence

| #   | step                                                                                                                     | evidence to hand in                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1   | **Context check.** Start a fresh agent with only the repo's context file. Have it explain how it would build the feature | its plan; every wrong assumption it made, and the context-file line you added to prevent it                    |
| 2   | **Skills.** Identify and load the relevant skills (`platform-components`, `directory-structure`, …)                      | which skills loaded, and whether any needed a version warning                                                  |
| 3   | **Isolation.** Create a worktree on a feature branch from a freshly fetched base                                         | `git worktree list`, the base SHA, and the fetch time with its offset                                          |
| 4   | **Build.** The agent implements the feature with a unit test                                                             | the diff                                                                                                       |
| 5   | **Verify.** Run the tests per file, mutation-check them, and typecheck with a planted-error control                      | test counts per file; the failing run with the fix reverted; typecheck reporting the planted error, then clean |
| 6   | **Gates.** Commit through the pre-commit hook and push to _your own_ remote through pre-push                             | hook output (no `--no-verify`)                                                                                 |
| 7   | **Review.** A second agent or person reviews using the module 5 checklist                                                | the review, including any method HOLDs                                                                         |
| 8   | **Ship plan.** Write a PRE-SHIP plan for a test environment, even a local Docker one                                     | the plan file, with every item measured                                                                        |
| 9   | **Deliver and verify.** Deploy, then confirm with the stage table from module 7                                          | the running tag and the HTTP response, each read by its own instrument                                         |
| 10  | **Write-up.** One page: what happened, what you measured, what you withdrew                                              | the page, with predicates, windows and offsets on every figure                                                 |

## Grading rubric

- **Pass:** every row has evidence that **could not have been produced by doing nothing**.
- **Distinction:** you found and fixed at least one false statement in a context file or code
  comment along the way, and recorded what it claimed.
- **Automatic rework:** any claim of "tests pass" or "deployed" without its artefact; any
  credential or internal URL in the write-up.

## Facilitator notes

- Expect the first attempt to stall at step 1: the context file will be missing something.
  That is the point of the exercise.
- Run step 7 across pairs, so that each participant reviews someone else's agent output.
- Time-box at about 3 hours for a familiar repo, or a full day if participants are new to it.
