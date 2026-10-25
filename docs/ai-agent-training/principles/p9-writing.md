# Principle P9 — Writing for humans and tools: make facts survive being quoted

## Why it matters

Two agents spent an hour comparing "5" against "8". Both numbers were correct. One counted a
specific assignment and the other counted any mention of the name. Re-running either count
returned the same right answer, so verification could not help. The error was entirely in
the comparison.

Agents write a lot: ticket comments, state files, commit messages, reports. Those words get
quoted onward by other agents and acted on by humans. Writing is part of the system.

## The principle

> **Publish what you looked at, not only what you saw. A number travels and its predicate
> does not.**

## Rules that held up

### State the predicate, inside the output

Print the predicate alongside the number:

```bash
echo "occurrences of the seed assignment: $(grep -c "formName: 'X'" file)"
```

A bare `5` gets quoted onward without its definition. `occurrences of the seed assignment: 5`
cannot be silently compared with `mentions of the name: 8`.

**Read a figure and its label as two separate claims.** "Is the number right?" has an
instrument. "Is it the number of what I said it is?" only has a reader. A count of
`docs:`-prefixed commits was correct, and labelling it as "commits that did not change
behaviour" was not.

### State the window, both kinds

- **Read window:** how much you examined. A `tail 25` of a log said "the job does nothing",
  while a `tail 40` showed it had done work an hour earlier.
- **Validity window:** how long the reading holds. "26 GB free" was accurate and fifteen
  minutes away from being false.

### Never write a bare date

The team works in UTC+8 and the servers run in UTC, so their calendar dates differ for 8 of
every 24 hours. A date without a time cannot be converted later by anyone. Write
`2026-10-15T14:00+08:00`. Get it from
`TZ=Asia/Manila date '+%Y-%m-%dT%H:%M:%S%:z'`, or from your own zone, and never by
extrapolating from an earlier reading.

**But evaluate a comparison in the frame its threshold states.** A loop guard said "if the
**UTC date** is >= …", so it must be compared with `date -u`. "Fixing" it to local time would
have fired the shutdown 8 hours early.

### Match the hedge to the shape of the uncertainty

`~06:35Z` reads as "centred on 06:35". If the evidence only proves "no later than 06:35",
write that. A one-sided bound written with a symmetric hedge invites exactly the conclusion
the evidence ruled out.

### Prefer durations to subtracting timestamps

A tool-emitted duration such as `Compiled successfully in 51s` has no time zone. Subtracting
two timestamps from different sources can mix time zones without anyone noticing.

### Distinguish capability from permission

"The node has 26 GB free, so attempt the promotion" answered _is it possible_ when the open
question was _is it allowed_. Before writing any instruction someone may act on, ask which of
the two you have actually established. **A wrong number produces a wrong belief, while an
unauthorised instruction in a ticket produces a wrong action.**

### A wrong number in an acceptance criterion is the most durable kind

Prose gets re-read. An acceptance criterion gets checked off once. A build duration read from
a listing that hid retried jobs became a baseline, then an acceptance criterion that the old
build already satisfied three times over. **Write the reason inside the criterion**, so that
nobody "simplifies" it back into the cheap version.

### Fence identifiers in rich-text systems

The ticket system parsed unfenced `snake_case` identifiers as markdown emphasis at write time:
`uat_chat_backbone_build` was stored as `uat*chat*backbone_build`. Underscores pair across a
whole block, so one bare identifier can corrupt another one elsewhere in the paragraph.
**Put every identifier in single backticks.** Then read the stored text back, because the
API's echo is not what was stored.

### Withdraw your own readings by name

When you were wrong, say so **where you published it**: "Withdrawn: my 22.5 MB/s figure divided
a net disk drop by a window; a net drop is not a transfer rate." The withdrawn version stays
visible so nobody rediscovers it as new.

### "My comment" may be unmeasurable

Every agent in this estate posts to the ticket system as the same account, so the author field
cannot tell you which agent wrote a comment. Identify a comment by its content or its ID, not
by "mine".

## Code comments are writing too

- A comment you can show is **false** is a defect. Fix it and record what it claimed.
- "Shorter is better" applies to code, not to a docblock that carries a measurement, a
  decision, or a superseded value and the reason it changed. Look at the `typecheck` job and
  the husky hooks in this repo: their comments say why each choice was made, with numbers.

## Exercises

1. **Predicate rewrite.** Take five numbers from your last status report. Rewrite each so the
   predicate and window travel with it.
2. **Bare-date sweep.** Search your docs for `\b20[0-9]{2}-[0-9]{2}-[0-9]{2}\b` without a
   following `T`. For each date, ask whether it is still recoverable.
3. **Echo vs storage.** Post a comment that contains a `snake_case` identifier, both fenced
   and unfenced, to a scratch ticket. Compare the echo, the readback and the rendered page.
