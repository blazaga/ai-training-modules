# Lab checks

Each hands-on lab has a check: a test file that starts its own copy of the app (on a free
port, in memory) and drives it over HTTP and MCP, the way a client would. Your running app
is not used, so there is nothing to restart first. The check never imports your code, so it
tells you whether the lab **behaves** as asked, not how you built it.

```bash
pnpm lab 01      # one lab (any part of the file name works: 01, orders, …)
pnpm lab         # every lab
```

(Without `corepack enable`, write `corepack pnpm lab 01`.)

**Read the counts.** A lab is done when its check reports `Test Files 1 passed` and every
test in `Tests` passed. A failure message names the rule it checks and usually says where
the fix belongs. `pnpm verify` must stay green as well: the lab checks are extra, not a
replacement for your own tests.

Every check is red on the base you start from, because the feature does not exist yet, and
green once your agent has built it. Each module ends with its checks green; the later ones
stay red until their module. Several labs then ask you to **break** a rule your agent built:
watch the check fail, put the rule back, and watch it pass again. A check that stays green
while you break its rule means the rule is not where you think it is.

| check             | lab                                      | module            | chapter |
| ----------------- | ---------------------------------------- | ----------------- | ------- |
| `01-orders`       | an `orders` resource                     | 1                 | 01      |
| `02-phone`        | `phone` on users                         | 2                 | 02      |
| `03-auth`         | Basic login, then JWT; one identical 401 | 3                 | 03      |
| `04-devices`      | devices: provision, rotate, archive      | 3                 | 04      |
| `06-publish-note` | MCP tools over stdio, and `publish-note` | 4                 | 06      |
| `08-transport`    | the same tools over Streamable HTTP      | 5                 | 08      |
| `09-rotation`     | device auth and rotation on `/mcp`       | 6                 | 09      |
| `12-expires-at`   | device secrets that expire               | stretch, after 6  | 04      |
| `10-capstone`     | device-scoped notes                      | homework, after 6 | 10      |

Chapters 05 and 07 have no check: their labs read the wire and script the Inspector, and
change no code. Fell behind? The course's `docs/ai-agent-training/checkpoints/` gets you to
the start of any module.

## The contracts

Your agent writes each contract into the resource's spec (`specs/<plural>.md`) before it
generates anything. The check holds it to exactly this.

### 01 · orders

| field      | rule                                                       |
| ---------- | ---------------------------------------------------------- |
| `item`     | string, 1-200 characters, required                         |
| `quantity` | whole number 1-100, default 1. **O1** (payload only) → 400 |
| `status`   | `open` or `fulfilled`, default `open`                      |

**O2:** once an order is `fulfilled`, its `quantity` cannot change. It needs stored state,
so it lives in the service and answers 422 `RULE_VIOLATION`. The routes follow the house
conventions (list as `{ items, … }`, unknown id 404, malformed id 400, DELETE 204), and no
`AI-FILL` marker is left in `src/orders/`. Storage is in memory, like `notes` (the
template's default); the check does not need a table.

For discussion: the contract does not say whether a fulfilled order may go back to `open`.
If it may, reopen → change → fulfil gets around O2. The resource-spec skill says to record
that as an open question, not to invent a rule.

### 02 · phone

`phone` is optional and E.164: a `+`, then 2-15 digits, the first not 0 (`+14155550123`).
Without it, users have `phone: null` in every response, and an explicit `null` on PATCH
clears it; anything else is 400. A committed
migration adds the column, and `pnpm check:migrations` is clean.

### 03 · Basic login, then JWT; one identical 401

`POST /api/v1/auth/login` with Basic credentials answers 200
`{ accessToken, tokenType: 'Bearer', expiresIn }`, and that token reaches
`GET /api/v1/auth/me`, which returns the public user (no password, no hash). Every login
failure (no header, wrong password, unknown email, bad base64) answers the same 401 body
with a `WWW-Authenticate: Basic` challenge. Every failure with a token on the other routes
(no header, Basic instead of a token, a token that is not a JWT) answers that same body with
a `WWW-Authenticate: Bearer` challenge. Full spec: `specs/auth.md`. **To break it**, give
unknown emails a different message at login. Changing the strategy alone does nothing if
the guard's `handleRequest` turns every failure into the same body: that is where the rule
is really enforced.

### 04 · devices: provision, rotate, archive

`POST /api/v1/devices/provision` `{ name }` answers 201 with an **active** device: a
`deviceKey` (`DK` + 16 characters `A-Z2-7`), a one-time `secret` (`dsk_…`) and `secretLast4`
(its last 4 characters). `GET` never shows `secret` or `secretHash`, and the list holds only
the caller's devices. `POST /api/v1/devices/:id/rotate` keeps the key and returns a new
secret. `DELETE` answers 204 and the device stays, `archived`; rotating it afterwards is 422.
Another user's device is 404 (never 403), and no token is 401. Full spec:
`specs/devices.md`. This check is HTTP only; the device headers on `/mcp` come in module 6.

### 06 · publish-note

An MCP tool `publish-note` with parameters `{ id: uuid }` that publishes the note **through
`NotesService`**, so rule R5 (a published note needs a body) applies. Errors are tool errors
whose text starts with the code: `RULE_VIOLATION: …` for an empty body, `NOT_FOUND: …` for
an unknown id. The stdio e2e test pins the exact tool list: update it on purpose. The check
talks to the tools over stdio while that is all there is, and over `/mcp` with a device once
module 5 serves it, so it stays green through the later modules.

### 08 · the same tools over Streamable HTTP

`/mcp` serves the same tools as stdio, answers as an SSE stream (`enableJsonResponse:
false`), sends no `Mcp-Session-Id` (`statefulMode: false`), and refuses a `Host` outside
`MCP_ALLOWED_HOSTS` with 403. Full spec: `specs/mcp.md`, module 5. **To break it**, flip
either setting in `src/bootstrap/attach-mcp.ts`, rebuild, and compare.

### 09 · device auth and rotation on `/mcp`

Only an `active` device gets into `/mcp`; an archived device, missing headers, Basic
credentials and a user's bearer token all get 401. Rotating keeps the device key, changes
the secret, and the old secret fails on the very next call. Full spec: `specs/mcp.md`,
module 6. **To break it**, let an archived device through `verifyDeviceKey`.

### 12 · device secrets that expire (stretch)

`POST /api/v1/devices/provision` and `POST /api/v1/devices/:id/rotate` take an optional
`"expiresAt": "<ISO datetime>"` in the body: in the future, else 400. The response carries
`expiresAt` (`null` when not given), rotating without it clears it, and `GET` on the device
shows it. An expired secret is refused by `verifyDeviceKey`, so `/mcp` answers the same 401
as any other failure; a secret without `expiresAt` keeps working. Compare against the clock
in TypeScript: the check moves the clock two hours forward. Store it as
`new Date(x).toISOString()` whatever offset was sent: SQLite keeps the exact string, and a
`+08:00` value then fails the response schema (a 500).

### 10 · capstone: device-scoped notes

Every note has an owner: the signed-in user over REST, the device's owner over MCP. Over
REST another user's note is 404 for GET, PATCH and DELETE and absent from the list. Over
MCP a new tool `my-notes` lists only the caller's notes, `create-note` gives the note to the
device's owner, and `get-note` on someone else's note is a `NOT_FOUND` tool error. Over stdio there is no device and so no
owner: the check does not test that case, so decide it in your spec (failing closed with a
tool error is the safe answer). Either way the stdio e2e test that creates and lists notes
changes with it: update it on purpose.

## When a check fails and you think you are right

Read the assertion: it names the rule and the request. Then reproduce the request yourself
(the Postman collection has every call), and compare what the contract above says with what
your spec says. A difference there is the bug, in one of the two.
