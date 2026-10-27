# Spec: authentication (Passport)

- **Libraries (already installed):** `@nestjs/passport`, `passport`, `passport-http`
  (Basic), `@nestjs/jwt`, `passport-jwt` (JWT).
- **Where:** `src/auth/` (a module, its strategies and guards) and `src/users/`
  (`verifyCredentials`).
- **Built in two steps.** Step 1 is Basic everywhere. Step 2 keeps Basic for login only and
  moves every other route to a token.

## Users: checking a password

`UsersService.verifyCredentials(email, password)` returns the user, or `undefined`.

- The email is matched case-insensitively (trim, lower-case).
- `undefined` for an unknown email, a wrong password and a user whose `status` is not
  `active`, all alike.
- An unknown email still runs one scrypt verify against a decoy hash, so response time does
  not reveal which emails exist.

## Step 1: Basic with `passport-http`

- A Passport strategy named `basic` (`passport-http`'s `BasicStrategy`); `validate(email,
password)` returns the PUBLIC user (no `passwordHash`) or `null`.
- A **global** guard (`APP_GUARD`) runs it: every route needs credentials unless marked
  `@Public()`. Public: `GET /api/health` and `POST /api/v1/users` (sign-up).
- `GET /api/v1/auth/me` returns the authenticated public user.
- **Every** failure is the same 401 body,
  `{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid credentials" }`, with
  `WWW-Authenticate: Basic realm="nest-ai-starter", charset="UTF-8"`. That includes a
  malformed or bare `Basic` header, which `passport-http` on its own answers with 400: the
  guard's `handleRequest` turns every failure into the one 401.
- `@CurrentUser()` gives handlers the public user.

## Step 2: login with Basic, then JWT

- `POST /api/v1/auth/login`: `@Public()`, guarded by the `basic` strategy only. Answers 200
  `{ "accessToken": "…", "tokenType": "Bearer", "expiresIn": <seconds> }`. Every failed login
  is the step-1 401 with the Basic challenge.
- A Passport strategy named `jwt` (`passport-jwt`), reading `Authorization: Bearer <token>`.
  The token carries `sub` (the user id) and `email`, nothing secret. `validate` looks the
  user up and returns the public user only while it is `active`, so a disabled user's token
  stops working.
- The **global** guard becomes the JWT guard. Public: health, sign-up and login. Every
  failure (no header, Basic instead of a token, not a JWT, bad signature, expired, unknown or
  disabled user) is the same 401 body with `WWW-Authenticate: Bearer realm="nest-ai-starter"`.
- Settings (declared in `src/config/env.schema.ts`, names in `.env.example`):
  - `JWT_SECRET`: at least 32 characters; **required when `NODE_ENV=production`**. When unset
    outside production, use a random key per process and log a warning (the key is never
    logged): tokens then stop working when the app restarts.
  - `JWT_EXPIRES_IN`: seconds, 60–86400, default 3600.
- OpenAPI: `addBearerAuth()`, so the docs UI has an "Authorize" button.

## Tests and house rules that change with auth

- `test/support/auth.ts` exports `basic(email, password)`, `login(app, email, password)` and
  `signUpAndLogin(app, user)` → `{ id, headers: { Authorization: 'Bearer …' } }`.
- Every e2e suite authenticates through it, and each resource's e2e suite has a test that a
  request without credentials gets 401.
- The resource template learns auth: an `access-create` marker above `@Post()` in the
  controller (add `@Public()` only if the spec makes creation public), an `e2e-setup` marker
  that signs up and logs in, and the 401 test.
- `CLAUDE.md` describes the auth convention (global guard, `@Public()`, one 401).
- The e2e auth suite proves: login returns a token that reaches `/me`; five failed logins
  give one body; four bad tokens give one body; a disabled user can neither log in nor use
  a token issued before.

## Known limit

`passport-http` 0.3.0 keeps only the text between the first and **second** colon of the
decoded credentials, so a password containing a colon cannot log in. Record it; do not work
around it with a hand-written parser.
