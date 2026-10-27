# Resource spec: devices

- **singular / plural:** `device` / `devices`
- **route:** `/api/v1/devices`
- **storage:** `drizzle` (SQLite table `devices`)
- **What a device is:** a non-human client, such as an AI agent calling the MCP server. It
  belongs to a user and proves who it is with a key and a secret sent as request headers.

## Fields

| field             | type             | constraints                      | default  | who sets it         |
| ----------------- | ---------------- | -------------------------------- | -------- | ------------------- |
| `name`            | string           | trimmed, 1–100 chars             | —        | client              |
| `description`     | string           | 0–500 chars                      | `''`     | client              |
| `status`          | enum             | `active` \| `archived`           | `active` | server (archive)    |
| `deviceKey`       | string \| null   | `DK` + 16 chars `A-Z2-7`, unique | —        | server (provision)  |
| `secretHash`      | string \| null   | sha256 hex of the secret         | —        | server, **private** |
| `secretLast4`     | string \| null   | last 4 chars of the secret       | —        | server              |
| `secretRotatedAt` | datetime \| null | —                                | `null`   | server (rotate)     |
| `lastUsedAt`      | datetime \| null | —                                | `null`   | server (MCP calls)  |
| `archivedAt`      | datetime \| null | —                                | `null`   | server (archive)    |

## Provisioning and credentials

- **`POST /devices/provision`** with `{ name, description? }` creates an **active** device for
  the calling user and returns it with its `deviceKey` and a one-time `secret` (201).
- **Generated on the server only.** `deviceKey = 'DK' + base32(10 random bytes)`;
  `secret = 'dsk_' + base64url(32 random bytes)`. The `dsk_` prefix makes a leaked secret
  findable by secret scanners.
- **Shown once:** the plain secret appears in the provision (and rotate) response only. It is
  never stored, logged or returned again.
- **Stored as `sha256(secret)`.** A fast hash is fine for a 256-bit random secret (brute
  force is infeasible), unlike passwords, which need scrypt. It is compared with
  `timingSafeEqual`.
- **Using it:** a device calls the MCP endpoint with `X-Device-Key: <deviceKey>` and
  `X-Device-Secret: <secret>`.
- **Rotation:** `POST /devices/:id/rotate` returns a new secret for the same key. The old
  secret stops working **immediately**, because its hash is replaced and nothing is cached.

## Rules

| #   | rule                                                                                          | where                     | error → HTTP               |
| --- | --------------------------------------------------------------------------------------------- | ------------------------- | -------------------------- |
| R1  | `status`, `deviceKey`, `secretLast4` and the timestamps are never accepted from a client      | schema (server-owned)     | unknown keys stripped      |
| R2  | an archived device cannot be rotated                                                          | service                   | `RuleViolationError` → 422 |
| R3  | an archived device cannot be edited                                                           | service                   | `RuleViolationError` → 422 |
| R4  | `DELETE` archives (soft delete): `status = archived`, `archivedAt` set, the key stops working | service                   | 204; idempotent            |
| R5  | `secretHash` never appears in any response                                                    | response schema (private) | —                          |

## Endpoints

`POST /provision` · `GET /` (the caller's devices) · `GET /:id` · `PATCH /:id` (name,
description) · `DELETE /:id` (archive) · `POST /:id/rotate`.

## Ownership

Every device belongs to the user who provisioned it (`ownerUserId`, server-owned, FK →
`users.id`). Every route is scoped to the caller: another user's device answers **404**
(not 403), so ids cannot be probed.

## Do not do

Keep a plaintext secret anywhere (a cache, a log, a "show secret" endpoint); generate
secrets on the client; keep an old secret valid for a grace period after rotation; tell a
client WHICH check failed.
