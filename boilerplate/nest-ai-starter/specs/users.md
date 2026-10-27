# Resource spec: users

The input an agent fills the AI-FILL markers from. If something the agent needs is not
here, the agent asks; it does not invent it.

- **singular / plural:** `user` / `users`
- **route:** `/api/v1/users`
- **storage:** `drizzle`. The table is **provided**: `src/users/users.table.ts`, already in
  migration `0000` and already holding seeded rows in `data/app.db`. Build the resource on
  it; do not generate a migration.

## Fields

| field   | type   | constraints                                                | default | client-settable |
| ------- | ------ | ---------------------------------------------------------- | ------- | --------------- |
| `email` | string | valid email, max 254 chars, **stored lower-cased**, unique | —       | yes             |
| `name`  | string | trimmed, 1–100 chars                                       | —       | yes             |

`id`, `createdAt` and `updatedAt` are server fields: returned, never accepted.

## Rules

| #   | rule                                                                                  | where                              | error → HTTP          |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------- | --------------------- |
| R1  | email is unique, case-insensitively (`Ada@Example.com` and `ada@example.com` collide) | schema lower-cases; table `unique` | `ConflictError` → 409 |
| R2  | a user who still owns notes cannot be deleted (the table's foreign key is RESTRICT)   | database → adapter                 | `ConflictError` → 409 |

Deleting a user removes the notes shared **with** them from their shared list (the
`note_shares` rows cascade); the notes themselves stay with their owners.

## Out of scope

Authentication: this service has none. Anyone who can reach it can read and change any row.
