# Resource spec: notes

The TODO items of this app. The input an agent fills the AI-FILL markers from. If something
the agent needs is not here, the agent asks; it does not invent it.

- **singular / plural:** `note` / `notes`
- **route:** `/api/v1/notes`
- **storage:** `drizzle`. The tables are **provided**: `src/notes/notes.table.ts` and
  `src/notes/note-shares.table.ts`, already in migration `0000` and already holding seeded
  rows in `data/app.db`. Build the resource on them; do not generate a migration.

A user **owns** many notes. A note can be **shared** with many users (`note_shares`, one
row per note and user).

## Fields

| field     | type                 | constraints                                                                                                                 | default | client-settable    |
| --------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------ |
| `ownerId` | uuid                 | an existing user                                                                                                            | —       | **on create only** |
| `title`   | string               | trimmed, 1–200 chars                                                                                                        | —       | yes                |
| `body`    | string               | 0–10,000 chars                                                                                                              | `''`    | yes                |
| `status`  | enum                 | `open` \| `done`                                                                                                            | `open`  | yes                |
| `dueAt`   | ISO datetime \| null | any offset (`Z` or `±hh:mm`) accepted, but **an offset is required** (no offset → 400); **stored as `toISOString()` (UTC)** | `null`  | yes                |

`id`, `createdAt` and `updatedAt` are server fields: returned, never accepted. `ownerId` is
not part of the PATCH schema, so a PATCH that sends it has the key ignored (the house schemas
strip unknown keys).

## Rules

| #   | rule                                                                                                                                                                                              | where              | error → HTTP                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------- |
| R1  | `ownerId` must be an existing user                                                                                                                                                                | service            | `RuleViolationError` → 422         |
| R2  | a `done` note cannot be edited: a PATCH on a done note may contain only `status: 'open'` (reopen it; reopening and editing in one request is 422 too)                                             | service            | `RuleViolationError` → 422         |
| R3  | `dueAt` is stored in one format, UTC `toISOString()`, whatever offset was sent (SQLite sorts the text). A value without an offset is refused: its UTC time would depend on the server's time zone | schema (transform) | validation → 400 if not a datetime |
| R4  | a note cannot be shared with its own owner                                                                                                                                                        | service            | `RuleViolationError` → 422         |

## Listing

`GET /api/v1/notes` takes the house paging (`limit`, `offset`) plus optional filters, which
combine with AND:

- `ownerId=<uuid>`: notes that user owns;
- `sharedWith=<uuid>`: notes shared with that user;
- `status=open|done`.

## Sharing

The list filters above and these routes go beyond the template's CRUD: add them in the
generated controller, service and repository (outside the markers), with e2e tests.

| request                                   | answer                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/v1/notes/:id/shares`            | 200 `{ items: User[] }`, the users it is shared with; unknown note 404                 |
| `PUT /api/v1/notes/:id/shares/:userId`    | 204; idempotent (sharing twice is still 204); unknown note or user 404; owner 422 (R4) |
| `DELETE /api/v1/notes/:id/shares/:userId` | 204; not shared with that user 404                                                     |

Deleting a note deletes its shares (the foreign key cascades).

## Out of scope

Authentication and permissions: anyone can edit any note. Who may share is a later concern.
