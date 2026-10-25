# Resource spec: users

- **singular / plural:** `user` / `users`
- **route:** `/api/v1/users`
- **storage:** `drizzle` (Postgres table `users`)

## Fields

| field          | type   | constraints                                                | default  | client-settable | private |
| -------------- | ------ | ---------------------------------------------------------- | -------- | --------------- | ------- |
| `email`        | string | valid email, max 254 chars, **stored lower-cased**, unique | —        | yes             | no      |
| `name`         | string | trimmed, 1–100 chars                                       | —        | yes             | no      |
| `status`       | enum   | `active` \| `disabled`                                     | `active` | yes             | no      |
| `passwordHash` | string | scrypt hash (see below)                                    | —        | **no**          | **yes** |

**Write-only input:** `password` on create only. It is 8–128 chars, is never stored as
given and is never returned. The service turns it into `passwordHash`. Changing a password
is out of scope for this chapter.

## Rules

| #   | rule                                                                                                                | where                              | error → HTTP          |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------- |
| R1  | email is unique, case-insensitively (`Ada@Example.com` and `ada@example.com` collide)                               | schema lower-cases; table `unique` | `ConflictError` → 409 |
| R2  | `password` is hashed with scrypt (random 16-byte salt) before storage; the plain value never reaches the repository | service                            | —                     |
| R3  | `passwordHash` never appears in any response                                                                        | response schema (private field)    | —                     |

## Repository queries

- `findByEmail(email)`: exact match on the stored (lower-cased) email. Needed by the auth
  chapter.

## Out of scope

Authentication (chapter 3), password change, email verification.
