# Chapter 03 — Auth: a BasicAuth middleware, then Passport

**You will:** authenticate against the users table twice: first by hand, to see every
moving part, then with Passport, secure by default. **Commits:** `course(ch03a)` (the
middleware), `course(ch03b)` (Passport). To read the hand-written version:
`git show "$(git log --format=%h -1 --grep='course(ch03a)')"`.

## Step 1: a hand-written HTTP Basic middleware

```bash
pnpm exec nest g module auth
pnpm exec nest g controller auth --no-spec
pnpm exec nest g middleware auth/basic-auth --no-spec --flat
```

- `parseBasicAuth()` implements RFC 7617: `Authorization: Basic base64(email:password)`,
  split at the **first** colon only, since passwords may contain colons.
- `UsersService.verifyCredentials()` returns the user or `undefined`. It is the same for
  an unknown email, a wrong password and a disabled account, and an unknown email still
  runs one scrypt verify against a decoy hash, so timing does not reveal which emails
  exist.
- The middleware applies to `GET /api/v1/auth/me` (in `configure()`). **Every failure
  gets the same 401 body** plus `WWW-Authenticate: Basic realm=…`; the e2e test collects
  the body of five different failures and asserts there is exactly one distinct body.

What we did _not_ verify: timing. The decoy equalises the work, but no test measures
response times. That would need a statistical test too flaky for CI, so we don't claim it.

## Step 2: Passport, secure by default

- Strategy `basic` (Passport) and a **global** `BasicAuthGuard` (`APP_GUARD`): every route
  needs credentials unless marked `@Public()` (health, sign-up). A forgotten decorator
  fails **closed** (401), never open.
- `@CurrentUser()` gives handlers the **public** user (no hash).
- The templates learned auth too: an `access-create` marker for public sign-up, an e2e
  `http` helper that sends credentials on every request, `e2e-setup` (sign up + Basic),
  and a generic "no credentials → 401" test.

### Why not `passport-http`'s BasicStrategy (measured, 0.3.0)

The obvious package has a bug we proved against the strategy itself:

```js
credentials = new Buffer(parts[1], 'base64').toString().split(':');
var password = credentials[1]; // only the text between colon 1 and colon 2
```

The password `correct horse: battery` arrives as `correct horse` and can never log in. A
bare `Basic` header fails with **400**, not 401. So the starter uses `passport-custom` with
the RFC-correct parser from step 1: Passport's model, without its bug. The e2e fixture
password contains a colon on purpose; making the parser truncate like passport-http
fails 3 tests.

## Mutation results (each must turn something red)

| mutant                                     | result                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| global guard removed                       | 5 e2e fail                                                                       |
| health not `@Public()`                     | 1 fails                                                                          |
| colon truncation (passport-http behaviour) | 3 fail                                                                           |
| sign-up not public                         | vitest **exit 1**, `Test Files 3 failed`, **but `Tests 2 passed \| 30 skipped`** |

That last row is a trap: when a `beforeAll` throws, vitest **skips** the file's tests, and
the `Tests` line shows no failures. Read `Test Files` and the exit code too (skill
`nest-verify`).

## Verify

Unit `Tests 44 passed`, e2e `Tests 32 passed`.

## Labs

Lab 2 is checked the other way round: `pnpm lab 03` passes on the starter, fails once
the 401 bodies differ, and passes again when you put the rule back. Hint: changing the
strategy alone changes nothing; find where every failure is turned into one body.

1. Add `GET /api/v1/users/me/devices` later in chapter 04. Which decorator gives you the
   user?
2. Make the 401 body differ between "unknown email" and "wrong password". Which test
   fails, and why is that test there?
3. Replace Basic with a bearer token. What changes in the strategy, and what stays?
