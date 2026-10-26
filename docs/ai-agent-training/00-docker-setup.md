# Chapter 00 — Everything in Docker

**You need:** Docker with Compose (measured on Docker Engine 29.7 / Compose v5.6). **You
don't need** Node, pnpm, Postgres or Redis on your machine: they all run in containers,
including the tools.

## The stack (`boilerplate/nest-ai-starter/docker-compose.yml`)

| service   | what                                                                                                | port on your machine | started by `up`?     |
| --------- | --------------------------------------------------------------------------------------------------- | -------------------- | -------------------- |
| `db`      | Postgres 17, healthcheck, data in volume `pgdata`                                                   | 5432                 | yes                  |
| `redis`   | Redis 8, healthcheck, data in volume `redisdata`. **Supporting infra: the app does not use it yet** | 6379                 | yes                  |
| `migrate` | one-shot: applies `drizzle/` migrations, prints the ledger, exits 0                                 | —                    | yes, before `app`    |
| `app`     | the service (production image), docs at `/api/docs`, MCP at `/mcp`                                  | 3000                 | yes                  |
| `dev`     | **the toolbox**: Node 24 + pnpm + all dependencies, your source mounted at `/app`                   | —                    | no (`--profile dev`) |

Start order is enforced: `db` and `redis` healthy → `migrate` **completes successfully**
→ `app` starts. If a migration fails, the app never starts on a half-migrated database.

## Run the stack

```bash
cd boilerplate/nest-ai-starter
docker compose up -d --build        # first run builds the images
docker compose ps                   # app: running (healthy), migrate: exited (0)
docker compose logs migrate         # db:migrate: ledger rows: 3
curl localhost:3000/api/health      # {"status":"ok"}
```

What we measured on this file (in a run where published ports were disabled because the
host was shared; nothing else changed):

- **Order and gating:** `migrate` printed `ledger rows: 3` and exited 0; the app then
  reported `healthy`; `redis-cli ping` → `PONG`.
- **Persistence:** `docker compose down` then `up -d` kept the data (users: 1 → 1), and
  `migrate` re-ran harmlessly (still 3 rows).
- **A clean wipe:** `docker compose down -v` removed every container, volume and network.

## The toolbox: every `pnpm …` in this course runs here

```bash
docker compose run --rm dev pnpm verify                     # the full gate
docker compose run --rm dev pnpm exec nest g resource orders --type rest --crud
docker compose run --rm dev pnpm resource:template --name order --plural orders
docker compose run --rm dev pnpm db:generate
docker compose run --rm dev sh                              # a shell, if you prefer
```

> **Rule for the rest of the course:** wherever a chapter says `pnpm X`, you can run
> `docker compose run --rm dev pnpm X`.

Measured inside the toolbox: `pnpm verify` exit 0, unit `Tests 67 passed`, e2e `Tests 61
passed`, the same as on a machine with Node. The e2e tests need **no** database
container, because they use PGlite in memory. The toolbox runs as user `node` (Node
v24.22.1, pnpm 12.15.0).

Things to know about the toolbox:

- **Your source is bind-mounted** (`.:/app`), so files that nest-cli or the template script
  create appear in your project. On Linux they are owned by uid 1000 (the image's `node`
  user).
- **Dependencies live in the image and in volume `dev_node_modules`, not on your host.**
  After `package.json` changes, run `docker compose run --rm dev pnpm install` and rebuild
  the images (`docker compose build`).
- _Not measured in this course's environment:_ the bind mount itself. Our test machine
  could not mount host paths, so we verified the toolbox with the source baked into its
  image. If the mount misbehaves on your machine, `docker compose run --rm --build dev
pnpm verify` tests a fresh copy of your source.

## Talking to the stack

| from                                                   | Postgres         | Redis            | the app                 |
| ------------------------------------------------------ | ---------------- | ---------------- | ----------------------- |
| your machine                                           | `localhost:5432` | `localhost:6379` | `http://localhost:3000` |
| another container on the compose network (the toolbox) | `db:5432`        | `redis:6379`     | `http://app:3000`       |

```bash
docker compose exec db psql -U app -d app -c 'select * from drizzle.__drizzle_migrations'
docker compose exec redis redis-cli ping
```

Calling the app's MCP endpoint by **service name** needs that name in
`MCP_ALLOWED_HOSTS` (chapter 08). The compose file sets `localhost,app`, and we measured
both sides: without `app`, a call from another container with valid credentials got
**403** `Invalid Host`; with it, 200.

## Calling the API with Postman

Every REST and MCP call in the labs is also in a Postman collection:
`boilerplate/nest-ai-starter/postman/nest-ai-starter.postman_collection.json`. Import it,
keep `baseUrl` at `http://localhost:3000`, and run the folders in order the first time
(03 signs up the demo user, 04 creates the device the MCP folders use). Each request has
tests: read the Test Results tab, not only the status code. The chapters show curl too; the
two are interchangeable.

The Inspector CLI (chapters 07 and 09) stays in the terminal: it is a real MCP client, which is the point of those chapters.

## Lab helper: a demo device in one command

From chapter 04 on, the labs need a user with an active device. On a running stack:

```bash
eval "$(docker compose run --rm -T dev node scripts/demo-device.mjs | grep '^export ')"
```

This signs up (or reuses) `demo@example.com`, creates a fresh device, issues its
credentials, activates it, and sets `DEVICE_ID`, `MCP_KEY_ID`, `MCP_SECRET` and
`DEMO_BASIC` in your shell. **Keep the `grep '^export '`.** When compose builds the image
first, the build log goes to the same stdout, and a bare `eval` would run those lines as
shell commands (measured: their `>` created 13 stray files in our project). The secret is printed once, for your terminal only.

## The MCP Inspector in Docker

The **CLI** works from the toolbox. This was measured end to end: a device created over
REST, then `whoami` through the Inspector, all inside the compose network:

```bash
docker compose run --rm dev npx -y @modelcontextprotocol/inspector@2.12.0 --cli \
  http://app:3000/mcp --method tools/call --tool-name whoami \
  --header "X-Access-Key-Id: AKID…" --header "X-Secret-Key: <SECRET>"
```

The **web UI** runs as the compose service `inspector` (profile `inspector`, so `up` does not
start it). Inside its own container it listens on every interface, which Inspector 2.12.0
refuses unless `DANGEROUSLY_BIND_ALL_INTERFACES=true`: that override is meant for exactly this
case. Docker publishes it on your machine's **loopback only** (`127.0.0.1:6274`), never on
your network.

1. Start it, then open the URL it prints (with its token):
   ```bash
   docker compose --profile inspector up -d inspector
   docker compose logs inspector   # http://localhost:6274/?MCP_INSPECTOR_API_TOKEN=…
   ```
2. **Add Servers** → **+ Add manually**: Server ID `nest-ai-starter`, Transport
   `streamable-http`, URL `http://app:3000/mcp` → **Add**. (The three example servers that
   are already listed can be ignored.)
3. On your server's card, **Settings** → **Custom Headers** → **+ Add Header** twice:
   `X-Access-Key-Id` and `X-Secret-Key`, with a device's values (the lab helper prints them).
   Close the dialog: header changes apply on the next connect.
4. Switch the card on: it shows **Connected**. Then **Tools** → pick a tool → **Execute Tool**.

Measured with a real browser on `localhost:6274`: connect with a device's headers, the four
tools listed, `whoami` returned the device and its owner. With a wrong secret the card shows
**Failed**, and the Network panel shows the Inspector probing `/.well-known/oauth-*`: it reads
any 401 as an OAuth challenge.

## Credentials

`app-local-only` is the Postgres password **for your machine only**. It is in the compose
file and in `.env.example` on purpose. Never reuse these values or this file for a
deployed environment.

## Stop and clean up

```bash
docker compose down        # stop; data kept
docker compose down -v     # stop and DELETE the data volumes
```
