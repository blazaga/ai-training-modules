# Module 3 — The OODA loop for agents: measure, don't recall

## Why it matters

During an outage, the explanation "the node cannot pull images from the registry" survived
for three hours. When a rollback failed on an image that was **already on the node**, that
was filed as further evidence of a pull problem. In fact it disproved the explanation: a
rollback to a local image does not need to pull anything. The outage lasted 66 minutes
longer than it needed to.

This was not a knowledge failure. The data was there. The explanation was being defended
instead of tested.

## The principle

The repo's `CLAUDE.md` makes the Boyd loop the governing discipline for every task:

> **Observe → Orient → Decide → Act, then back to Observe.** It is a loop, not a checklist.
> Most failures are a step skipped, not a step done badly.

### Observe: measure, don't recall, and use the right instrument

Read live state when you need it, not at the start of the turn. A ticket status read at
the start of a pass and stated as current at the end had changed 45 seconds earlier.
**A measurement with a timestamp is not a current fact.**

Questions that look alike can need different instruments. This is the table from the repo:

| question                                      | instrument                                |
| --------------------------------------------- | ----------------------------------------- |
| Is this **commit on this branch**?            | `git merge-base --is-ancestor`            |
| Is this **change present, whatever its SHA**? | `git patch-id --stable`, or read the file |
| Is this **deployed**?                         | the running container's image tag         |
| Is the image **even on the node**?            | the node's own image store                |
| **Will these two branches merge?**            | `git merge-tree --write-tree a b`         |

Traps that each cost real time in this estate:

- `--is-ancestor` **says no for cherry-picked content.** It answers a question about a
  commit's identity, while you usually want to know whether the content is there.
- `patch-id` **is empty for merge commits**, so two merges "match" even though nothing was
  compared.
- `git log -S` **does not report content that arrived through a merge** under default
  history simplification. To check whether content exists at a ref, read the file at that
  ref with `git show <ref>:<path>`.
- **"Many commits apart" does not mean "conflict".** Run the merge with `merge-tree`. A
  29-ahead/25-behind divergence that was published as a conflict merged clean.

### Orient: update the model, don't defend it

Ask what the evidence would look like **if your current explanation were wrong**, then go and
check for exactly that.

- **Run a negative control before publishing a cause**, and make sure it differs from the
  subject in exactly one way. A control that differs in two ways tests nothing.
- **A uniform result across many probes means one broken instrument, not many findings.**
  Three successive "0 bytes reclaimed" readings were one reading repeated: the same filter
  excluded the same images each time.
- **Name what would change your mind.** If nothing would, you are not oriented, you are
  committed.
- **Never claim a scenario is impossible unless you have measured it.** Code comments
  claiming "can't happen" were wrong eleven times here, six of them in one review pass. If
  you cannot cite a measurement, handle the case.

### Decide: commit, and state the gate

Say what you are deciding against before you act: _"I deploy when all three images are
confirmed on the node, not before."_ The staging outage mentioned above began with a deploy
decided before the images were verified as present.

- **Default to measure → act → report, not to asking.** Ask a blocking question only when
  going ahead would be unsafe, destructive or visible outside the team. Otherwise do all the
  work that does not depend on the answer, state your assumption, and carry on.
- When a question really is blocking, deliver the groundwork anyway and ask exactly one
  question.

### A probe that writes is a change, not a measurement

To find out what input format a ticket API accepted for a rich-text field, an agent sent a
one-word test value **to a live, populated field** and destroyed that ticket's acceptance
criteria. The question did not depend on which field was used, so a scratch ticket would have
answered it with nothing at risk. **If a probe's cost falls on the thing being probed, probe
something else.**

### Act: then verify the property you care about

Acting is not finishing, and a proxy for the result is not the result. Module 4 covers this
in depth.

### Then loop, and withdraw readings by name

Report what is true, not what is tidy. When evidence changes, **withdraw your own earlier
reading explicitly, in the same place you published it**, so the next reader is not misled.

## Making agents run the loop

- Put the loop **in the context file** with concrete examples from your own incidents.
  Abstract advice does not change behaviour, and your own scars do.
- Give **instruments, not adjectives.** "Check carefully" does nothing. "Read the file at the
  ref with `git show <ref>:<path>`" does.
- **Make the remedies positional.** Rules that depend on an agent remembering them fail.
  Remedies that sit where the decision happens work: the warning beside the command, the
  measurement step inside the brief, the predicate printed in the command's output.

## Exercises

1. **Instrument drill.** For each question in the table, construct a case in a scratch repo
   where the wrong instrument gives the wrong answer. For example, cherry-pick a commit and
   show that `--is-ancestor` says no while the content is present.
2. **Negative control.** Pick a recent bug whose cause you "know". Design a control that
   differs in one variable, run it, and record whether the cause survived.
3. **Probe safety.** List three questions you have answered by writing to a real system. For
   each, name a target where the same probe would cost nothing.
