# Resource spec: notes

The input an agent fills the AI-FILL markers from. Write one of these per resource
**before** running the scaffold. If something the agent needs is not here, the agent
asks; it does not invent it.

- **singular / plural:** `note` / `notes`
- **route:** `/api/v1/notes`

## Fields

| field    | type     | constraints                                                      | default | client-settable |
| -------- | -------- | ---------------------------------------------------------------- | ------- | --------------- |
| `title`  | string   | trimmed, 1–200 chars                                             | —       | yes             |
| `body`   | string   | 0–10,000 chars                                                   | `''`    | yes             |
| `status` | enum     | `draft` \| `published`                                           | `draft` | yes             |
| `tags`   | string[] | each: lowercase `a-z0-9-`, 1–30 chars; at most 10; no duplicates | `[]`    | yes             |

## Rules

Rules that only need the **payload** go in the schema. Rules that need **stored state**
go in the service.

| #   | rule                                                                                                    | where                              | error → HTTP               |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------- |
| R1  | `tags` contain no duplicates                                                                            | schema                             | validation → 400           |
| R2  | a note created as `published` must have a non-empty `body`                                              | schema (payload-only, cross-field) | validation → 400           |
| R3  | once `published`, a note's `title` cannot change                                                        | service (needs stored state)       | `RuleViolationError` → 422 |
| R4  | a `published` note cannot go back to `draft`                                                            | service (needs stored state)       | `RuleViolationError` → 422 |
| R5  | publishing through PATCH requires the resulting `body` (patch value, else stored value) to be non-empty | service (needs stored state)       | `RuleViolationError` → 422 |

> R5 was added while writing this spec. R2 alone left a hole: create a draft with an
> empty body, then PATCH it to `published`. This is the kind of gap an agent should
> raise as a question, not quietly close with a rule of its own.

## Out of scope

Authentication, persistence beyond memory, search.
