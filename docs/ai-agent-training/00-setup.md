# Chapter 00 — Setup: Node, pnpm and one SQLite file

**You need:** Node 24 (measured on 24.22; `package.json` also accepts 22.22.3 and later) and
pnpm through corepack, which ships with Node. **You don't need** a database server: the
database is **SQLite**, a single file, `data/app.db`, created for you.

## Install

```bash
cd boilerplate/nest-ai-starter
corepack enable            # puts the pinned pnpm (12.15.0) on your PATH
pnpm install
cp .env.example .env       # DATABASE_URL=file:./data/app.db, PORT=3000
```

If `corepack enable` is not allowed on your machine, write `corepack pnpm` wherever this
course writes `pnpm`.

## Run the app

```bash
pnpm build                          # compile to dist/
pnpm db:migrate                     # create data/app.db and apply drizzle/; prints the ledger: 3 rows
pnpm start                          # http://localhost:3000, docs at /api/docs, MCP at /mcp
curl localhost:3000/api/health      # {"status":"ok"}
```

`pnpm start:dev` does the same with a file watcher: it rebuilds and restarts when you save.

Order matters: the app never migrates a file database itself, so `pnpm db:migrate` comes
first, and again after every new migration. Running it twice is harmless.

What we measured on this file:

- **Migrate:** `pnpm db:migrate` created `data/app.db` and printed `ledger rows: 3`; a
  second run applied nothing and still printed 3.
- **Persistence:** after stopping and restarting the app, signing up the same user again
  answered 409 (the row was still in the file).
- **A clean wipe:** stop the app and delete `data/`. The next `pnpm db:migrate` starts from
  an empty database (the same user signed up again: 201).
- **Forgot to migrate?** The app starts anyway, and every database call answers 500; the
  log says `no such table: users`. Stop it, run `pnpm db:migrate`, start again.
- **Watch mode:** with `pnpm start:dev` running, saving a file printed
  `File change detected`, recompiled and restarted the app.

## The gate: `pnpm verify`

```bash
pnpm verify      # typecheck, lint, format, AI-FILL markers, migrations, unit, e2e
```

Measured: exit 0, unit `Tests 69 passed`, e2e `Tests 61 passed`. No test touches
`data/app.db`: under test the app ignores `.env` (the vitest configs set `NODE_ENV=test`), so
the tests use an in-memory SQLite database, migrated from the same committed SQL. So you can
run `pnpm verify` while the app is running, which we did.

Why that matters: the e2e tests and the lab checks boot the whole app, and an app that read
`.env` would open the same file as your running app. We measured that state: `SQLITE_BUSY:
database is locked`, 409s on sign-ups the tests expected to create, and `Tests 1 failed | 27
passed | 33 skipped`.

## Calling the API with Postman

Every REST and MCP call in the labs is also in a Postman collection:
`boilerplate/nest-ai-starter/postman/nest-ai-starter.postman_collection.json`. Import it,
keep `baseUrl` at `http://localhost:3000`, and run the folders in order the first time
(03 signs up the demo user, 04 creates the device the MCP folders use). Each request has
tests: read the Test Results tab, not only the status code. The chapters show curl too; the
two are interchangeable.

## Lab helper: a demo device in one command

From chapter 04 on, the labs need a user with an active device. With the app running:

```bash
eval "$(node scripts/demo-device.mjs)"
```

This signs up (or reuses) `demo@example.com`, creates a fresh device, issues its
credentials, activates it, and sets `DEVICE_ID`, `MCP_KEY_ID`, `MCP_SECRET` and
`DEMO_BASIC` in your shell. The secret is printed once, for your terminal only.

## The MCP Inspector

The **CLI** is a real MCP client in your terminal (chapters 07 and 09):

```bash
npx -y @modelcontextprotocol/inspector@2.12.0 --cli \
  http://localhost:3000/mcp --method tools/call --tool-name whoami \
  --header "X-Access-Key-Id: $MCP_KEY_ID" --header "X-Secret-Key: $MCP_SECRET"
```

The **web UI** runs on your machine's loopback (`127.0.0.1:6274`), never on your network.

1. Start it, then open the URL it prints (with its token):
   ```bash
   pnpm mcp:inspect:ui     # http://localhost:6274/?MCP_INSPECTOR_API_TOKEN=…
   ```
2. **Add Servers** → **+ Add manually**: Server ID `nest-ai-starter`, Transport
   `streamable-http`, URL `http://localhost:3000/mcp` → **Add**. (The three example servers
   that are already listed can be ignored.)
3. On your server's card, **Settings** → **Custom Headers** → **+ Add Header** twice:
   `X-Access-Key-Id` and `X-Secret-Key`, with a device's values (the lab helper prints them).
   Close the dialog: header changes apply on the next connect.
4. Switch the card on: it shows **Connected**. Then **Tools** → pick a tool → **Execute Tool**.

Measured with a real browser on `localhost:6274`: connect with a device's headers, the four
tools listed, `whoami` returned the device and its owner. With a wrong secret the card shows
**Failed**, and the Network panel shows the Inspector probing `/.well-known/oauth-*`: it reads
any 401 as an OAuth challenge.

## Credentials

There is no database password: SQLite is a file, and access to it is access to `data/`.
`data/` and `.env` are git-ignored. The demo user and passphrase used in the labs are for
your machine only; never reuse them for a deployed environment.

## Stop and clean up

Stop the app with Ctrl+C. To start over with an empty database, delete `data/` and run
`pnpm db:migrate` again.
