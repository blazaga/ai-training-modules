# Resource spec: devices

- **singular / plural:** `device` / `devices`
- **route:** `/api/v1/devices`
- **storage:** `drizzle` (SQLite table `devices`)
- **Modelled on:** dna_forms, where a device is a non-human account with an app id + secret
  sent as request headers. This spec keeps that shape and **corrects** the weaknesses
  measured there (see "Do not copy").

## Fields

| field             | type             | constraints                        | default | who sets it          |
| ----------------- | ---------------- | ---------------------------------- | ------- | -------------------- |
| `name`            | string           | trimmed, 1–100 chars               | —       | client               |
| `description`     | string           | 0–500 chars                        | `''`    | client               |
| `status`          | enum             | `draft` \| `active` \| `archived`  | `draft` | server (actions)     |
| `accessKeyId`     | string \| null   | `AKID` + 16 chars `A-Z2-7`, unique | `null`  | server (credentials) |
| `secretHash`      | string \| null   | sha256 hex of the secret           | `null`  | server, **private**  |
| `secretLast4`     | string \| null   | last 4 chars of the secret         | `null`  | server               |
| `secretRotatedAt` | datetime \| null | —                                  | `null`  | server               |
| `lastUsedAt`      | datetime \| null | —                                  | `null`  | server (ch09)        |
| `archivedAt`      | datetime \| null | —                                  | `null`  | server (archive)     |

## Credentials

- **Generated on the server only.** `accessKeyId = 'AKID' + base32(10 random bytes)`;
  `secret = 'dsk_' + base64url(32 random bytes)`. The `dsk_` prefix makes a leaked secret
  findable by secret scanners.
- **Shown once:** `POST /devices/:id/credentials` returns `{ accessKeyId, secret,
secretLast4 }`. The plain secret is never stored, logged or returned again.
- **Stored as `sha256(secret)`.** A fast hash is fine for a 256-bit random secret
  (brute force is infeasible), unlike passwords, which need scrypt. It is compared with
  `timingSafeEqual`.
- **Rotation** = calling the same endpoint again: a new secret, the same `accessKeyId`. The
  old secret stops working **immediately**, because its hash is replaced and nothing is
  cached.

## Rules

| #   | rule                                                                                                                                 | where                     | error → HTTP               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | -------------------------- |
| R1  | `status`, `accessKeyId`, `secretLast4` and the timestamps are never accepted from a client                                           | schema (server-owned)     | unknown keys stripped      |
| R2  | credentials cannot be issued for an `archived` device                                                                                | service                   | `RuleViolationError` → 422 |
| R3  | activation requires issued credentials and a non-archived device                                                                     | service                   | `RuleViolationError` → 422 |
| R4  | `DELETE` only removes a `draft` device (never activated; nothing returns a device to draft). Active devices must be archived instead | service                   | `RuleViolationError` → 422 |
| R5  | archiving sets `status = archived` and `archivedAt`; an archived device cannot be edited                                             | service                   | `RuleViolationError` → 422 |
| R6  | `secretHash` never appears in any response                                                                                           | response schema (private) | —                          |

## Extra endpoints (beyond the template's CRUD)

`POST /:id/credentials` (issue or rotate) · `POST /:id/activate` · `POST /:id/archive`.

## Ownership (ch04 step 2: "merge with users")

Every device belongs to the user who created it (`ownerUserId`, server-owned, FK →
`users.id`). Every route is scoped to `req.user`: another user's device answers **404**
(not 403), so ids cannot be probed.

## Do not copy (measured in the reference system)

The plaintext secret was cached in Redis and readable back through a query endpoint;
secrets were generated in the browser; rotation left a cached secret valid for minutes;
auth failures returned detailed reasons to the client.
