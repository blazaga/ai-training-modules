# Principle P5 — Verification discipline: ask the artefact, not the exit code

## Why it matters

Each row below was a real reading in this estate. The left column is what a tool or process
reported. The right column is what was actually true.

| what reported                                            | what was true                                                                                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| test run summary shows **no failures**                   | a `RangeError`, with the summary reading `Test Files no tests · Errors 1`. **The worst of the set**: the tool is telling you something is wrong, and the output still looks like a pass |
| `pnpm test:unit -- <path>` **exits 0** with empty output | **no tests ran**, and 9 stray test-runner processes were left behind                                                                                                                    |
| full-repo `tsc` prints **`0 errors`**                    | the process was **killed for running out of memory** (exit 137), so the count came from a dead process                                                                                  |
| `tsc … \| head` **exits 0**                              | that is the exit status of `head`, not of `tsc`                                                                                                                                         |
| CI image-transfer job **exits 0**                        | its guard had failed, a retry skipped the work, and **nothing shipped**                                                                                                                 |
| database migration job runs **clean**                    | the image did not contain the migration, so it **applied nothing** and reported success                                                                                                 |
| a deployment config edit's guards **all pass**           | nothing had changed, so every guard trivially held                                                                                                                                      |
| infrastructure API returns **HTTP 504**                  | **the update had been applied**: a failure reported for a success                                                                                                                       |
| pipeline status **`success`** with all jobs green        | the default job listing **hides retried jobs**. Two jobs had hung for 77 minutes and the green ones were the retries                                                                    |
| two commits' patch-ids **match**                         | both were merge commits, for which patch-id is an **empty string**, so empty matched empty                                                                                              |

## The principle

> **Verify the artefact, never the exit code. A clean exit is a hypothesis about the
> artefact, not evidence of it, and the signal can be wrong in both directions.**

So ask the artefact directly. Is the image on the node? Is the column in the schema? Did the
file change? Did the test actually execute, and how many tests ran in each file?

## Sorting signals: sound and unsound

A useful question for any "pass" signal:

> _Can this signal be produced by doing nothing?_

- **Unsound:** exit 0, "no errors", an empty diff, "0 bytes reclaimed". Doing nothing produces
  all of these.
- **Sound:** a test runner reporting `14 passed` for a named file. An image digest present in
  the node's image list. A row in the migrations ledger table.
- **A surprising sound one:** a Docker BuildKit `RUN` step marked `CACHED`. BuildKit never
  caches a step that exited non-zero, so a cached layer proves that exact command once
  succeeded on that exact input. But it is evidence that this content passed at some point,
  not that the gate ran today, and with a remote cache it may not have been fast.

## Concrete techniques used in this repo

**Tests: count per file.**

```bash
corepack pnpm vitest run --environment jsdom src/path/to/file.test.ts
# Confirm the summary names the file and shows N passed, N > 0.
```

The charter for the agent pool says this in as many words: _"`pnpm test:unit` with a path can
exit 0 having run nothing."_

**Regression tests: mutation-check them.** A fix ships with a test that **fails without the
fix**. Revert the fix, watch the test fail, then restore it. A test that passes either way is
not testing the fix.

**Typecheck: prove that the checker can fail.**

```bash
NODE_OPTIONS=--max-old-space-size=6144 corepack pnpm exec tsc --noEmit
```

At the default heap size, the full-repo typecheck runs out of memory. Add a deliberate type
error as a control, confirm it is reported, then remove it. A typecheck that cannot report
your planted error proves nothing about the real code.

**Pipelines: watch the exit status of the right command.** `$?` after a pipe is the status of
the last command in the pipe. Use `${PIPESTATUS[0]}`, or do not pipe what you need the status
of.

**Logs: check the marker is unique to the path you claim.**

- To prove a code path was **not** taken, grep for a marker that only that path emits. If it
  is absent, that is conclusive.
- To prove a path **was** taken, you need a marker unique to that path. A line printed after
  two branches join proves only that execution reached the join.
- Line-anchored regexes such as `^#12 DONE` silently fail on CI logs where every line starts
  with a timestamp, and two jobs in the same pipeline can differ in whether they do.

**Readbacks: the echo is not storage.** When writing to a ticket system, the API's echo of
your comment is not what was stored. Read it back. Even the readback can be a
re-serialisation, so **keep the payload you sent**, because it is the only record of your
input.

## The direction nobody checks

Every defence above asks whether the artefact is as good as the description. The reverse also
fails: a correct fix whose **stated reason** is wrong. Testing the fix confirms it, while the
wrong reason teaches the next reader the wrong rule. **When you record why something works,
check that the reason would actually have produced that artefact.**

## Three kinds of mistake, and what catches each

| kind                                                            | example                                                                   | caught by                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| content vs identity                                             | `--is-ancestor` says no for a cherry-pick                                 | a different instrument (read the file)                             |
| artefact vs exit code                                           | CI exits 0, nothing shipped                                               | checking the artefact                                              |
| two correct numbers compared as if they measured the same thing | "5" vs "8", where one counts assignments and the other counts any mention | **nothing you re-run.** Only stating the predicate catches it (P9) |

## Exercises

1. **False-green hunt.** Run your test command with a path filter that matches nothing. Does it
   exit 0? Write a wrapper that fails when zero tests ran.
2. **Plant a type error.** Confirm that your typecheck in CI actually reports it. Then check
   whether CI fails the pipeline or only reports the error. An `allow_failure` gate is not a
   gate.
3. **Mutation-check a recent fix.** Revert only the fix and keep the test. Does the test fail?
4. **Pipe audit.** Search your scripts for `| tee`, `| head` and `| grep` after commands whose
   status matters, and fix them with `PIPESTATUS` or `set -o pipefail`.
