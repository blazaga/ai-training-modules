# Lab checks

Each hands-on lab has a check: a test file that drives the running app over HTTP and MCP,
the way a client would. It never imports your code, so it tells you whether the lab
**behaves** as asked, not how you built it.

```bash
pnpm lab 01      # one lab (any part of the file name works: 01, orders, …)
pnpm lab         # every lab
```

(Without `corepack enable`, write `corepack pnpm lab 01`.)

**Read the counts.** A lab is done when its check reports `Test Files 1 passed` and every
test in `Tests` passed. A failure message names the rule it checks and usually says where
the fix belongs. `pnpm verify` must stay green as well: the lab checks are extra, not a
replacement for your own tests.

There are two kinds of check:

- **Build labs** fail on the starter, because the feature does not exist yet, and pass once
  you have built it.
- **Guard labs** pass on the starter. The lab is to break the rule on purpose, watch the
  check fail, then put it back and watch it pass again.

| check             | lab                      | kind  | full chapter | lite module  |
| ----------------- | ------------------------ | ----- | ------------ | ------------ |
| `01-orders`       | an `orders` resource     | build | 01           | 1            |
| `02-phone`        | `phone` on users         | build | 02           | 2            |
| `03-auth`         | one identical 401        | guard | 03           | 3            |
| `04-expires-at`   | credentials that expire  | build | 04           | 3            |
| `06-publish-note` | the `publish-note` tool  | build | 06           | 4            |
| `08-transport`    | Streamable HTTP settings | guard | 08           | 5            |
| `09-rotation`     | device auth and rotation | guard | 09           | 6            |
| `10-capstone`     | device-scoped notes      | build | 10           | 6 (homework) |

Chapters 05 and 07 have no check: their labs read the wire and script the Inspector, and
change no code.

## The contracts

Write each contract into the resource's spec (`specs/<plural>.md`) before you generate
anything. The check holds you to exactly this.

### 01 · orders

| field      | rule                                                       |
| ---------- | ---------------------------------------------------------- |
| `item`     | string, 1-200 characters, required                         |
| `quantity` | whole number 1-100, default 1. **O1** (payload only) → 400 |
| `status`   | `open` or `fulfilled`, default `open`                      |

**O2:** once an order is `fulfilled`, its `quantity` cannot change. It needs stored state,
so it lives in the service and answers 422 `RULE_VIOLATION`. The routes follow the house
conventions (list as `{ items, … }`, unknown id 404, malformed id 400, DELETE 204), and no
`AI-FILL` marker is left in `src/orders/`.

For discussion: the contract does not say whether a fulfilled order may go back to `open`.
If it may, reopen → change → fulfil gets around O2. The resource-spec skill says to record
that as an open question, not to invent a rule.

### 02 · phone

`phone` is optional and E.164: a `+`, then 2-15 digits, the first not 0 (`+14155550123`).
Without it, users have `phone: null` in every response; anything else is 400. A committed
migration adds the column, and `pnpm check:migrations` is clean.

### 03 · one identical 401 (guard)

Every auth failure (no header, wrong password, unknown email, other scheme, bad base64)
answers the same 401 body with a `WWW-Authenticate: Basic` challenge. **To break it**, give
unknown emails a different message. You will find that changing the strategy alone does
nothing: `BasicAuthGuard.handleRequest` turns every failure into the same body. That is
where the rule is really enforced.

### 04 · credentials that expire

`POST /api/v1/devices/:id/credentials` takes an optional `{ "expiresAt": "<ISO datetime>" }`:
in the future, else 400. The response carries `expiresAt` (`null` when not given), issuing
again without it clears it, and `GET` on the device shows it. An expired secret is refused
by `verifyAccessKey`, so `/mcp` answers the same 401 as any other failure. Compare against
the clock in TypeScript: the check moves the clock two hours forward.
Store it as `new Date(x).toISOString()` whatever offset was sent: SQLite keeps the exact
string, and a `+08:00` value then fails the response schema (a 500).

### 06 · publish-note

An MCP tool `publish-note` with parameters `{ id: uuid }` that publishes the note **through
`NotesService`**, so rule R5 (a published note needs a body) applies. Errors are tool errors
whose text starts with the code: `RULE_VIOLATION: …` for an empty body, `NOT_FOUND: …` for
an unknown id. The stdio e2e test pins the exact tool list: update it on purpose.

### 08 · transport settings (guard)

`/mcp` answers as an SSE stream (`enableJsonResponse: false`), sends no `Mcp-Session-Id`
(`statefulMode: false`), and refuses a `Host` outside `MCP_ALLOWED_HOSTS` with 403. **To
break it**, flip either setting in `src/bootstrap/attach-mcp.ts`, rebuild, and compare.

### 09 · device auth and rotation (guard)

Only an `active` device gets into `/mcp`; draft, archived, missing headers and Basic
credentials all get 401. Issuing credentials again keeps the key id, changes the secret,
and the old secret fails on the very next call. **To break it**, let a non-active device
through `verifyAccessKey`.

### 10 · capstone: device-scoped notes

Every note has an owner: the signed-in user over REST, the device's owner over MCP. Over
REST another user's note is 404 for GET, PATCH and DELETE and absent from the list. Over
MCP a new tool `my-notes` lists only the caller's notes, `create-note` gives the note to the
device's owner, and `get-note` on someone else's note is a `NOT_FOUND` tool error.

## When a check fails and you think you are right

Read the assertion: it names the rule and the request. Then reproduce the request yourself
(the Postman collection has every call), and compare what the contract above says with what
your spec says. A difference there is the bug, in one of the two.
