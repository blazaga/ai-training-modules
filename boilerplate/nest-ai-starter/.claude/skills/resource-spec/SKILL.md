---
name: resource-spec
description: Write or review the spec for a new REST resource (specs/<plural>.md) before any code is generated. Use when asked to add a resource and no spec exists, or when a spec looks incomplete. Produces fields, rules with their placement and HTTP error, and open questions.
---

# Write a resource spec

The spec is the agent's only source of truth in step 3 of `nest-resource-scaffold`.
Anything not written here gets invented, and invented rules are bugs nobody asked for.

Template: copy `specs/notes.md` and replace its content.

## Required sections

1. **Names:** singular / plural in lower kebab-case, and the route `/api/v1/<plural>`.
2. **Fields table:** name, type, constraints, default, whether the client can set it.
   `id`, `createdAt` and `updatedAt` are added by the template, so do not list them.
3. **Rules table:** for each rule give a number (R1…), the rule in one sentence, its
   **placement**, and the error → HTTP status it maps to:
   - needs only the request payload → **schema** → 400
   - needs stored state → **service** → `RuleViolationError` 422 or `ConflictError` 409
   - the resource does not exist → `NotFoundError` 404 (already handled by the template)
4. **Out of scope:** what this resource deliberately does not do.

## Hunt for gaps before handing it over

For every rule, ask **"is there another path to the same forbidden state?"** The worked
example found one this way: R2 forbade _creating_ a published note with an empty body,
but nothing stopped _patching_ a draft to published. That became R5.

Common gaps:

- a create-time rule with no matching update-time rule;
- a state machine with no rule about going backwards;
- uniqueness enforced on create but not on rename;
- a default that changes meaning when a field is cleared.

## Questions, not guesses

If the requester has not answered something, put it under **Open questions** and stop.
Do not pick an answer to keep moving: a guessed rule passes every test you write for it.
