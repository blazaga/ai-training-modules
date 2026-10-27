# Chapter 03 — Auth with Passport: Basic, then JWT

**Your agent will:** add authentication in two steps, both with Passport, from two instructions
in module 3 (the spec is `specs/auth.md`). First **Basic**: a user
proves who they are with an email and password. Then **JWT**: they trade that proof for a
token once, and send the token on every other request. **Files:** `src/auth/`.

Passport does the protocol work in both steps. A strategy reads the credentials from the
request and calls your `validate()`; a guard runs the strategy and decides what a failure
looks like. Your code only answers "who is this, if anyone".

## Step 1: Basic, with `passport-http`

```ts
// src/auth/basic.strategy.ts
@Injectable()
export class BasicStrategy extends PassportStrategy(HttpBasicStrategy, 'basic') {
  constructor(private readonly users: UsersService) {
    super();
  }

  async validate(email: string, password: string): Promise<UserResponse | null> {
    const user = await this.users.verifyCredentials(email, password);
    return user ? UserResponseSchema.parse(user) : null;
  }
}
```

- `passport-http` decodes `Authorization: Basic base64(email:password)` and hands over the
  two values.
- `UsersService.verifyCredentials()` returns the user or `undefined`. It is the same for an
  unknown email, a wrong password and a disabled account. An unknown email still runs one
  scrypt verify against a decoy hash, so response time does not reveal which emails exist.
- Basic guards **one** route: `POST /api/v1/auth/login`, through `BasicLoginGuard`.

**Every failure gets the same 401 body** plus `WWW-Authenticate: Basic realm=…`.
`BasicLoginGuard.handleRequest` turns every failure into that one body. That includes a bare
`Basic` header, which `passport-http` on its own answers with **400** (measured on 0.3.0).

**A known limit of `passport-http` 0.3.0 (measured):** it keeps only the text between the
first and **second** colon, so a password such as `correct horse: battery` arrives as
`correct horse` and can never log in.

## Step 2: JWT, with `passport-jwt`

Basic sends the password with every request, and the server checks it with scrypt each
time. A token is the better handler for everything after login:

- **The password crosses the wire once**, at login.
- **It expires** (`JWT_EXPIRES_IN`, default 3600 seconds), so a leaked token has a limit.
- **It is cheap to check**: a signature, not a password hash.

```bash
# log in: Basic once, a token back
curl -s -X POST localhost:3000/api/v1/auth/login -u 'ada@example.com:correct horse battery'
# {"accessToken":"eyJ…","tokenType":"Bearer","expiresIn":3600}

# every other request: the token
curl -s localhost:3000/api/v1/auth/me -H "Authorization: Bearer eyJ…"
```

- `JwtStrategy` reads `Authorization: Bearer …`. `passport-jwt` checks the signature and the
  expiry; `validate()` then looks the user up, so a token stops working as soon as its user
  is disabled (an e2e test proves it).
- `JwtAuthGuard` is **global** (`APP_GUARD`): every route needs a token unless it is marked
  `@Public()` (health, sign-up, login). A forgotten decorator fails **closed** (401), never
  open. Every failure is the same 401 body, with `WWW-Authenticate: Bearer`.
- `@CurrentUser()` gives handlers the **public** user (no hash).
- The signing key is `JWT_SECRET` (at least 32 characters). Production refuses to start
  without it. In development, leaving it unset gives a random key per process, and the log
  says so: tokens then stop working when the app restarts.

The templates know about auth too. A new resource's e2e test signs up and logs in through
`test/support/auth.ts` (`signUpAndLogin`), and a generic "no credentials → 401" test comes
with every resource.

## What the tests prove (measured)

| check                                                                                        | result                              |
| -------------------------------------------------------------------------------------------- | ----------------------------------- |
| login, then the token reaches `/me`; the response has no password                            | e2e passes                          |
| five failed logins (incl. a bare `Basic`) → one body, Basic challenge                        | e2e passes                          |
| no token, Basic instead of a token, a non-JWT, a tampered token → one body, Bearer challenge | e2e passes                          |
| a disabled user can neither log in nor use a token issued before                             | e2e passes                          |
| mutant: `validate()` stops checking that the user is active                                  | 1 e2e fails                         |
| mutant: the guard puts the failure reason in the body                                        | `pnpm lab 03`: 3 fail; e2e: 1 fails |

When a `beforeAll` throws, vitest **skips** the file's tests, and the `Tests` line shows no
failures. Read `Test Files` and the exit code too (skill `nest-verify`).

## Labs

`pnpm lab 03` is red on the base and green once your agent has built step 2. Run it after
each step: after step 1 the login test still fails (there is no token yet), which is the
point of building it in two steps.

Lab 2 is a mutation check on what your agent wrote: make the 401 bodies differ, watch
`pnpm lab 03` fail, put the rule back and watch it pass. Hint: changing the strategy alone
changes nothing; find where every failure is turned into one body. If nothing fails when the
bodies differ, your agent's tests do not pin the rule: that is a finding, not a pass.

1. Log in with `curl -u`, then call `/api/v1/auth/me` with the token. Then call it with the
   Basic header instead. What answers, and why?
2. Make the login 401 differ between "unknown email" and "wrong password". Which test
   fails, and why is that test there?
3. Set `JWT_EXPIRES_IN=60`, restart, log in, wait a minute and call `/me`. What do you get,
   and what would a client have to do about it?
