#!/usr/bin/env node
// Builds the lecturer's lab-companion deck in TWO formats from ONE source:
//   lab-companion.pptx  (PowerPoint)
//   lab-companion.md    (Marp-compatible Markdown; plain Markdown viewers work too)
// Both come from the SLIDES array below, so they cannot drift apart.
//
// Rebuild (any machine with Docker; see README.md in this folder):
//   node build-lab-deck.mjs [outDir]
// Requires the npm packages pptxgenjs, react, react-dom, react-icons and sharp.
// MD_ONLY=1 writes only the two Markdown files.
// Optional: APPLY_THEME_JS=/path/to/apply_theme.js also writes the colours into the
// .pptx theme, so PowerPoint's theme picker shows them.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pptxgen = require('pptxgenjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const Fi = require('react-icons/fi');

const OUT = process.argv[2] ?? '.';
const FOOTER = 'Lab companion · Building apps with AI agents · NestJS + MCP';

// ---- palette (charcoal "terminal" + mint for checkpoints + amber for snags) ----
const COL = {
  ink: '1B1F24', // dark backgrounds, terminal cards
  slate: '2B3440',
  paper: 'FFFFFF',
  mist: 'F1F5F9', // light cards
  mint: '1FB68A',
  amber: 'E69A28',
  red: 'E5484D',
  text: '1B1F24',
  muted: '64748B',
  code: 'E6EDF3',
  comment: '8B98A5',
  soft: 'CBD5E1',
};
const THEME = {
  name: 'Lab Companion',
  headFontFace: 'Calibri',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: COL.ink, lt1: COL.paper, dk2: COL.slate, lt2: COL.mist,
    accent1: COL.mint, accent2: COL.amber, accent3: '7C5CFF', accent4: COL.red,
    accent5: '0F766E', accent6: '94A3B8', hlink: '0F766E', folHlink: '7C5CFF',
  },
};
const CODE_FONT = 'Courier New';

// ---- the content ----------------------------------------------------------------
// Draft lab times are ESTIMATES, not measured with learners: adjust after a dry run.
// `outputSource` says where each checkpoint output came from:
//   captured      observed on this code while the course was built
//   from the code literal values from the source (not a captured terminal)
//   expected      what should appear; checking it IS part of the lab
const CH = (n, title, minutes, goal) => ({ n, title, minutes, goal });
const CHAPTERS = [
  CH('00', 'Everything in Docker', 15, 'Start the stack and the toolbox. Everything else in the course runs here.'),
  CH('01', 'CLI and templates', 30, 'Add an `orders` resource: generate → template → fill → verify.'),
  CH('02', 'Users with drizzle and zod', 25, 'Add a `phone` column and watch the migration checks work for you.'),
  CH('03', 'Auth: middleware, then Passport', 15, 'Break the "one identical 401" rule on purpose and see which test catches it.'),
  CH('04', 'Devices and ownership', 25, 'Issue, rotate and inspect device credentials; then add `expiresAt`.'),
  CH('05', 'MCP: envelopes and transports', 10, 'Send a raw `initialize` and read the JSON-RPC and SSE framing.'),
  CH('06', 'Your first MCP controller', 25, 'Add a `publish-note` tool and pin it with tests.'),
  CH('07', 'Using the MCP Inspector', 15, 'Turn an Inspector call into a CI check with its exit code.'),
  CH('08', 'stdio → Streamable HTTP', 15, 'Flip `enableJsonResponse` and compare what goes over the wire.'),
  CH('09', 'MCP auth with device keys', 15, 'Rotate a secret mid-session and watch the next call fail.'),
  CH('10', 'Capstone', 60, 'Device-scoped notes through every layer, with evidence.'),
];
const DEMO = `eval "$(docker compose run --rm -T dev \\
  node scripts/demo-device.mjs | grep '^export ')"`;

const SLIDES = [
  {
    type: 'title',
    title: 'Building Apps with AI Agents',
    subtitle: 'Lab companion · NestJS 12 · drizzle · Passport · MCP · all in Docker',
    notes:
      'Keep this deck on screen during lab work. Each chapter has: a divider (goal + time), RUN THIS (commands), CHECKPOINT (what correct looks like) and IF YOU ARE STUCK (snags we actually hit). The full explanations are in the chapter documents.',
  },
  {
    type: 'flow',
    title: 'How every lab works',
    steps: [
      ['Spec', 'specs/<name>.md: fields, rules, gaps'],
      ['Generate', 'nest-cli: structure + wiring'],
      ['Template', 'house conventions, identical every time'],
      ['Fill', 'your agent, ONLY inside AI-FILL markers'],
      ['Verify', 'pnpm verify: read the counts'],
    ],
    notes:
      'The repeatable work belongs to tools; judgement belongs to the agent, fenced into markers. If a learner hand-edits generated code, steer them back to the template or the marker.',
  },
  {
    type: 'rules',
    title: 'Three rules for the lab',
    rows: [
      ['FiTerminal', '`dev` = the toolbox', "alias dev='docker compose run --rm dev'. Every `pnpm X` in the course becomes `dev pnpm X`."],
      ['FiCheckCircle', 'Counts, not exit codes', 'Read "Tests N passed" AND "Test Files": a failed beforeAll shows 0 failures in the Tests line and exit 1.'],
      ['FiLock', 'Never share a secret', 'Device secrets, Basic credentials and Inspector URLs (they carry a token) stay in your terminal.'],
    ],
    notes:
      'PowerShell has no alias for multi-word commands: function dev { docker compose run --rm dev @args }. Not tested here; Linux, macOS and WSL shells were the target.',
  },
  {
    type: 'agenda',
    title: 'The track (draft lab times)',
    notes:
      'Times are ESTIMATES. Nobody has run these labs with an audience yet. Adjust after the first session. Chapter 10 works well as homework.',
  },

  // ---------------------------------------------------------------- ch00
  { type: 'section', ch: '00' },
  {
    type: 'run', ch: '00', title: 'Run this: the stack and the toolbox',
    code: [
      'cd boilerplate/nest-ai-starter',
      'docker compose up -d --build',
      'docker compose ps -a',
      'docker compose logs migrate',
      'curl localhost:3000/api/health',
      '',
      "alias dev='docker compose run --rm dev'",
      'dev pnpm verify',
    ],
    notes: 'The first build takes a few minutes. While it runs, walk through docker-compose.yml: db, redis (infra only), migrate (one-shot), app, dev (profile).',
  },
  {
    type: 'checkpoint', ch: '00', title: 'Checkpoint: stack up, gate green',
    outputSource: 'captured (abridged)',
    output: [
      '# docker compose ps -a  (STATUS)',
      'app       Up … (healthy)',
      'migrate   Exited (0)',
      '# docker compose logs migrate',
      'db:migrate: ledger rows: 3',
      '# curl …/api/health',
      '{"status":"ok"}',
      '# dev pnpm verify',
      'Tests  67 passed (67)',
      'Tests  61 passed (61)',
    ],
    done: [
      'app healthy, migrate exited 0',
      'ledger rows: 3 (read the ledger, not a log line)',
      'both Tests lines AND both "Test Files … passed"',
    ],
    notes: 'Counts are from the final starter. If a learner sees fewer tests, they are on an older commit.',
  },
  {
    type: 'stuck', ch: '00', title: 'If you are stuck: chapter 00',
    rows: [
      ['A port is already in use', 'Something local owns 5432, 6379 or 3000. Stop it, or change the LEFT side of that `ports:` entry.'],
      ['app never starts', 'By design if `migrate` failed: `docker compose logs migrate`. The app waits for a successful migration.'],
      ['Changed package.json?', '`dev pnpm install`, then `docker compose build`. Dependencies live in the image, not on your host.'],
    ],
  },

  // ---------------------------------------------------------------- ch01
  { type: 'section', ch: '01' },
  {
    type: 'run', ch: '01', title: 'Run this: add an orders resource',
    code: [
      '# 1. write specs/orders.md (copy specs/notes.md)',
      'dev pnpm exec nest g resource orders \\',
      '  --type rest --crud',
      'dev pnpm resource:template \\',
      '  --name order --plural orders',
      'dev pnpm check:ai-fill      # your to-do list',
      '# 2. your agent fills every AI-FILL marker',
      '#    from specs/orders.md',
      'dev pnpm verify',
    ],
    notes: 'Learners should give their agent the spec and the skill name (nest-resource-scaffold), not ad-hoc instructions.',
  },
  {
    type: 'checkpoint', ch: '01', title: 'Checkpoint: markers to zero, rules pinned',
    outputSource: 'captured, then expected',
    output: [
      '# captured: after the template step',
      'files written: 11;',
      'AI-FILL markers to complete: 16',
      '# expected: after your agent filled them',
      'AI-FILL markers: 0',
      'Tests  N passed  (N > 67)',
    ],
    done: [
      'check:ai-fill prints 0 markers',
      'delete each service rule once: exactly one test goes red',
      'verify green, counts read aloud',
    ],
    notes: 'The mutation step is the point: a rule nobody has tried deleting is a rule nobody has proven is tested.',
  },
  {
    type: 'stuck', ch: '01', title: 'If you are stuck: chapter 01',
    rows: [
      ['"Run step 1 first"', 'The template script refuses before `nest g resource`, and refuses a second run. Never use --force after filling.'],
      ['PATCH wiped my fields', 'Keep `patchSchema()`: zod `.partial()` re-applies defaults (measured on zod 4.4.3 and 4.6.7).'],
      ['Unit green, e2e red', 'Validation, defaults and status codes live at the HTTP boundary. Only e2e sees them.'],
    ],
  },

  // ---------------------------------------------------------------- ch02
  { type: 'section', ch: '02' },
  {
    type: 'run', ch: '02', title: 'Run this: add a phone column',
    code: [
      '# 1. specs/users.md: phone (optional, E.164)',
      '# 2. user.schema.ts + users.table.ts',
      'dev pnpm check:migrations   # FAILS: drift',
      'dev pnpm db:generate        # READ the SQL',
      'dev pnpm check:migrations   # clean now',
      'dev pnpm verify',
      'docker compose up -d --build',
      'docker compose logs migrate',
    ],
    notes: 'Make learners read the generated SQL out loud. A nullable ADD COLUMN is safe on populated tables; NOT NULL is not (chapter 04).',
  },
  {
    type: 'checkpoint', ch: '02', title: 'Checkpoint: drift caught, ledger grows',
    outputSource: 'captured messages, expected count',
    output: [
      '# before db:generate (captured)',
      'check-migrations: DRIFT - tables',
      '  changed without a migration.',
      '# db:generate (captured format)',
      '[✓] Your SQL migration file ➜',
      '    drizzle/0003_….sql',
      '# after up -d --build (expected)',
      'db:migrate: ledger rows: 4',
    ],
    done: [
      'check:migrations failed BEFORE generating',
      'you read the SQL in `drizzle/0003_*`',
      'ledger rows: 4; phone appears in responses',
    ],
  },
  {
    type: 'stuck', ch: '02', title: 'If you are stuck: chapter 02',
    rows: [
      ['All tests pass, check fails', 'Correct: tests run on the MIGRATION SQL (PGlite), not your TypeScript table. Generate the migration.'],
      ['Drift test fails', 'The zod schema and the table must declare exactly the same fields, with the same TS names.'],
      ['The generated SQL says NOT NULL', 'That fails on populated tables (measured). Use nullable, then backfill, then SET NOT NULL.'],
    ],
  },

  // ---------------------------------------------------------------- ch03
  { type: 'section', ch: '03' },
  {
    type: 'run', ch: '03', title: 'Run this: see the 401, then break it',
    code: [
      "git log --oneline --grep 'course(ch03'",
      'curl -s localhost:3000/api/v1/users \\',
      "  -H 'content-type: application/json' -d \\",
      '  \'{"email":"me@example.com","name":"Me",',
      '    "password":"my long passphrase"}\'',
      'curl -i localhost:3000/api/v1/auth/me',
      "curl -i -u me@example.com:'my long passphrase' \\",
      '  localhost:3000/api/v1/auth/me',
      '# lab: change the message for unknown emails',
      'dev pnpm test:e2e     # which test fails?',
    ],
    notes: 'Then revert. `git show 8e46c2097` is the hand-written middleware version, worth reading next to the Passport one.',
  },
  {
    type: 'checkpoint', ch: '03', title: 'Checkpoint: one 401 for every failure',
    outputSource: 'values from the code',
    output: [
      'HTTP/1.1 401 Unauthorized',
      'WWW-Authenticate: Basic',
      '  realm="nest-ai-starter", charset="UTF-8"',
      '{"statusCode":401,"error":"Unauthorized",',
      ' "message":"Invalid credentials"}',
      '# with -u: HTTP/1.1 200 OK, no password',
      '# after your change, e2e reports:',
      '× every failure is the SAME 401 …',
    ],
    done: [
      'you saw the test that pins the rule fail',
      'you can say why the bodies must be identical',
      'reverted; verify green',
    ],
  },
  {
    type: 'stuck', ch: '03', title: 'If you are stuck: chapter 03',
    rows: [
      ['"2 passed | 30 skipped", exit 1', 'A beforeAll threw (e.g. sign-up lost @Public()). The failure is on the Test Files line.'],
      ['My new route answers 401', 'Secure by default: the guard is global. Add @Public() only on purpose.'],
      ['Password with a colon fails', 'Not with our parser. passport-http truncates at the 2nd colon (measured). Do not swap it in.'],
    ],
  },

  // ---------------------------------------------------------------- ch04
  { type: 'section', ch: '04' },
  {
    type: 'run', ch: '04', title: 'Run this: credentials, rotation, ownership',
    code: [
      DEMO,
      'curl -s -H "Authorization: $DEMO_BASIC" \\',
      '  localhost:3000/api/v1/devices/$DEVICE_ID',
      'curl -s -X POST -H "Authorization: $DEMO_BASIC" \\',
      '  localhost:3000/api/v1/devices/$DEVICE_ID/credentials',
      '# lab: add expiresAt: spec → schema → table',
      '#      → migration → rule → tests',
    ],
    notes: 'The helper prints exports only; keep the grep. With a bare eval, compose build-log lines would run as shell commands (measured).',
  },
  {
    type: 'checkpoint', ch: '04', title: 'Checkpoint: the secret appears once',
    outputSource: 'expected (asserted by e2e)',
    output: [
      '# GET device',
      '"status":"active",',
      '"accessKeyId":"AKID…",',
      '"secretLast4":"…"     (no secret, no hash)',
      '# POST …/credentials (rotation)',
      '"secret":"dsk_…"      (shown ONCE)',
      'same accessKeyId, new secretLast4',
    ],
    done: [
      'no response but /credentials ever shows a secret',
      'an expired secret fails verifyAccessKey (unit test)',
      'another user\'s device → 404 still holds',
    ],
  },
  {
    type: 'stuck', ch: '04', title: 'If you are stuck: chapter 04',
    rows: [
      ['"contains null values"', 'Your NOT NULL migration hit existing rows (measured). Hand-edit: nullable → decide → SET NOT NULL.'],
      ['Deleting a user gives a 500', 'Blocked FK deletes report 23001 (RESTRICT) or 23503 (NO ACTION). The adapter maps both to 409.'],
      ['Another user\'s device is 404', 'By design: 404, not 403, so ids cannot be probed.'],
    ],
  },

  // ---------------------------------------------------------------- ch05
  { type: 'section', ch: '05' },
  {
    type: 'run', ch: '05', title: 'Run this: a raw MCP initialize',
    code: [
      DEMO,
      'curl -s -i -X POST localhost:3000/mcp \\',
      "  -H 'content-type: application/json' \\",
      "  -H 'accept: application/json, text/event-stream' \\",
      '  -H "X-Access-Key-Id: $MCP_KEY_ID" \\',
      '  -H "X-Secret-Key: $MCP_SECRET" \\',
      '  -d \'{"jsonrpc":"2.0","id":1,"method":"initialize",',
      '   "params":{"protocolVersion":"2025-06-18",',
      '   "capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}\'',
    ],
    notes: 'Then ask: which id answers which request? Where is the SSE framing? What would a tool error look like vs a protocol error?',
  },
  {
    type: 'checkpoint', ch: '05', title: 'Checkpoint: JSON-RPC inside SSE',
    outputSource: 'captured',
    output: [
      'HTTP/1.1 200 OK',
      'content-type: text/event-stream',
      '',
      'event: message',
      'data: {"result":{',
      '  "protocolVersion":"2025-06-18", …',
      '  "serverInfo":{"name":"nest-ai-starter",…}},',
      ' "jsonrpc":"2.0","id":1}',
    ],
    done: [
      'you matched the response id to the request',
      'you named request / response / notification',
      'tool error (isError) vs protocol error (error)',
    ],
  },
  {
    type: 'stuck', ch: '05', title: 'If you are stuck: chapter 05',
    rows: [
      ['401 Unauthorized', 'Missing headers, a draft or archived device, or a rotated secret: one 401 for all. Re-run the helper.'],
      ['403 Invalid Host', 'You called the app by a name not in MCP_ALLOWED_HOSTS (compose sets localhost,app).'],
      ['Plain JSON, no SSE', 'enableJsonResponse is true: the DEFAULT of @rekog/mcp-nest 2.0.8. Ours sets false.'],
    ],
  },

  // ---------------------------------------------------------------- ch06
  { type: 'section', ch: '06' },
  {
    type: 'run', ch: '06', title: 'Run this: add a publish-note tool',
    code: [
      '// src/mcp/notes.tools.ts',
      '@Tool({',
      "  name: 'publish-note',",
      "  description: 'Publish a note. A published note needs a non-empty body.',",
      '  parameters: z.object({ id: z.string().uuid() }),',
      '})',
      'publishNote(@Payload() { id }: { id: string }): Promise<ToolResult> {',
      "  return runTool(() => this.notes.update(id, { status: 'published' }));",
      '}',
    ],
    notes: 'Then: dev pnpm verify. The stdio e2e test pins the EXACT tool list, so it fails until they update it deliberately. That is the lesson.',
  },
  {
    type: 'checkpoint', ch: '06', title: 'Checkpoint: the rule holds over MCP',
    outputSource: 'captured',
    output: [
      '# publish-note on a note with no body',
      '{"content":[{"type":"text","text":',
      '  "RULE_VIOLATION: A published note',
      '   needs a non-empty body"}],',
      ' "isError":true}',
      '# tools/list',
      'create-note, get-note, list-notes,',
      'publish-note, whoami',
    ],
    done: [
      'the stdio e2e tool list updated on purpose',
      'a test: publishing an empty note → isError',
      'the RAW stdout test still green',
    ],
  },
  {
    type: 'stuck', ch: '06', title: 'If you are stuck: chapter 06',
    rows: [
      ['console.log "for debugging"', 'It goes into the protocol stream. The SDK client ignores it, so only the RAW stdout test fails.'],
      ['Old behaviour in tests', 'The e2e setup rebuilds dist/ and fails on a stale one. Never test yesterday\'s build.'],
      ['A crash instead of isError', 'Wrap tool bodies in runTool(): DomainError → tool error the model can read.'],
    ],
  },

  // ---------------------------------------------------------------- ch07
  { type: 'section', ch: '07' },
  {
    type: 'run', ch: '07', title: 'Run this: the Inspector as a CI check',
    code: [
      'dev pnpm build',
      'dev pnpm mcp:inspect:cli --method tools/list',
      'dev pnpm mcp:inspect:cli --method tools/call \\',
      '  --tool-name get-note \\',
      '  --tool-arg id=00000000-0000-4000-8000-000000000000',
      'echo "exit: $?"',
    ],
    notes: 'The web UI binds 127.0.0.1 inside its container. In Docker use the CLI; learners with Node can run the UI on the host with npx.',
  },
  {
    type: 'checkpoint', ch: '07', title: 'Checkpoint: a tool error is exit 5',
    outputSource: 'captured (through pnpm + compose)',
    output: [
      '{ "content": [ { "type": "text",',
      '  "text": "NOT_FOUND: Note … not found" } ],',
      '  "isError": true }',
      'exit: 5',
    ],
    done: [
      "a script that FAILS when create-note accepts `{title:'x', status:'published'}`",
      'you know why this exit code is a SOUND signal',
    ],
    notes: 'Exit 5 comes from the tool\'s own isError, not from the absence of a crash. That is why it is safe to rely on here.',
  },
  {
    type: 'stuck', ch: '07', title: 'If you are stuck: chapter 07',
    rows: [
      ['No such file dist/mcp-stdio.js', 'Build first: dev pnpm build.'],
      ['Web UI unreachable', 'It listens on 127.0.0.1 inside the container. Use the CLI, or npx on your host.'],
      ['Sharing the UI URL', 'Don\'t: it carries MCP_INSPECTOR_API_TOKEN, which is a credential.'],
    ],
  },

  // ---------------------------------------------------------------- ch08
  { type: 'section', ch: '08' },
  {
    type: 'run', ch: '08', title: 'Run this: JSON vs SSE on the wire',
    code: [
      '# 1. capture the chapter 05 initialize (SSE)',
      '# 2. src/bootstrap/attach-mcp.ts:',
      '#      enableJsonResponse: true',
      'docker compose up -d --build app',
      '# 3. same curl again: what changed?',
      'curl -s -o /dev/null -w "%{http_code}\\n" \\',
      "  -X POST -H 'Host: evil.example' \\",
      '  localhost:3000/mcp       # Host check',
    ],
    notes: 'Revert enableJsonResponse afterwards. Ask why the e2e Host test uses node:http and not fetch.',
  },
  {
    type: 'checkpoint', ch: '08', title: 'Checkpoint: same message, two framings',
    outputSource: 'before captured, after expected',
    output: [
      '# enableJsonResponse: false (captured)',
      'content-type: text/event-stream',
      'event: message',
      'data: {"result":…}',
      '# enableJsonResponse: true (expected)',
      'content-type: application/json',
      '{"result":…}',
    ],
    done: [
      'both responses captured and compared',
      'you can say why fetch cannot test Host',
      'MCP_ALLOWED_HOSTS explained in one sentence',
    ],
  },
  {
    type: 'stuck', ch: '08', title: 'If you are stuck: chapter 08',
    rows: [
      ['Host test without credentials', 'You get 401, not 403: device auth runs first. Send the device headers too.'],
      ['My fetch Host test passes 200', 'fetch silently replaces Host (measured). Use curl or node:http.'],
      ['Called by service name: 403', 'Add that name to MCP_ALLOWED_HOSTS (reproduced in Docker).'],
    ],
  },

  // ---------------------------------------------------------------- ch09
  { type: 'section', ch: '09' },
  {
    type: 'run', ch: '09', title: 'Run this: rotate mid-session',
    code: [
      DEMO,
      'dev npx -y @modelcontextprotocol/inspector@2.12.0 \\',
      '  --cli http://app:3000/mcp \\',
      '  --method tools/call --tool-name whoami \\',
      '  --header "X-Access-Key-Id: $MCP_KEY_ID" \\',
      '  --header "X-Secret-Key: $MCP_SECRET"',
      'curl -s -X POST -H "Authorization: $DEMO_BASIC" \\',
      '  localhost:3000/api/v1/devices/$DEVICE_ID/credentials',
      '# run the same Inspector command again',
    ],
    notes: 'The rotation output contains the NEW secret. Tell learners not to paste it anywhere; redirect it to /dev/null if screens are shared.',
  },
  {
    type: 'checkpoint', ch: '09', title: 'Checkpoint: rotation bites immediately',
    outputSource: 'first call captured, second expected',
    output: [
      '# first whoami (captured)',
      '"device": { … "status": "active" … },',
      '"owner":  { … "email": "demo@example.com" }',
      '# after rotation, same headers (expected)',
      'HTTP 401 → the Inspector reports',
      '  auth_required (it expects OAuth)',
    ],
    done: [
      'the old secret failed on the NEXT call',
      'the 7 failure modes → one 401, explained',
      'why stdio whoami is a tool error (local trust)',
    ],
    notes: 'The Inspector treats any 401 as an OAuth challenge. Device keys suit header-configured machine clients; the OAuth path is @rekog/mcp-nest-auth (not built in this course).',
  },
  {
    type: 'stuck', ch: '09', title: 'If you are stuck: chapter 09',
    rows: [
      ['Inspector says auth_required', 'That IS your 401. Check the headers, or re-run the helper for a fresh device.'],
      ['whoami over stdio fails', 'By design: stdio trusts the local user; there is no device identity.'],
      ['Auth seems bypassed', 'The middleware must be registered BEFORE the transport mounts (measured: after = bypassed).'],
    ],
  },

  // ---------------------------------------------------------------- ch10 + close
  { type: 'section', ch: '10' },
  {
    type: 'capstone', title: 'Capstone: hand in evidence, not claims',
    items: [
      'spec diff + every open question you raised',
      'plan with a verify line per task',
      'the migration SQL, and what you hand-edited',
      'unit + e2e counts; owner-check mutation result',
      'my-notes e2e: two devices of two users',
      'pnpm verify: every line, incl. Test Files',
      'Inspector capture with headers (secret redacted)',
      'WORKLOG entry, with any corrections',
    ],
    notes: 'Distinction: a false statement found in a comment, skill, spec or this course, measured and corrected. Rework: "tests pass" without counts, or any credential in an artefact.',
  },
  {
    type: 'closing', title: 'What you built',
    chain: ['Docker stack', 'REST + drizzle', 'Auth', 'Devices', 'MCP server'],
    next: 'Next: OAuth for interactive MCP clients (@rekog/mcp-nest-auth) · Redis-backed rate limits · deploy with MCP_ALLOWED_HOSTS set',
    notes: 'Close by asking each learner for one false statement they found in a tool, a doc or this course, and how they measured it.',
  },
];

// ---- the LITE track: the same process in six modules ------------------------------
// Same loop (spec → generate → template → fill → verify) and the same four-slide pattern
// per module; chapters are merged, and each module keeps ONE lab. What was cut is in the
// divider notes, so a lecturer can pull a full-track lab back in as a stretch.
// Slides marked fromFull() are the full track's slides, unchanged apart from the label.
const MOD = (n, title, minutes, goal, covers) => ({ n, title, minutes, goal, covers });
const MODULES = [
  MOD('1', 'Setup and the loop', 40, 'Start the stack, then add an `orders` resource: generate → template → fill → verify.', '00 + 01'),
  MOD('2', 'Data: drizzle and zod', 25, 'Add a `phone` column and watch the migration checks work for you.', '02'),
  MOD('3', 'Identity: auth and devices', 30, 'Break the "one identical 401" rule on purpose, then issue and rotate device credentials.', '03 + 04'),
  MOD('4', 'Your first MCP server', 30, 'Read one raw JSON-RPC exchange, then add a `publish-note` tool and pin it with tests.', '05 + 06'),
  MOD('5', 'Inspector and transports', 25, 'Turn an Inspector call into a CI check, then flip `enableJsonResponse` and compare the wire.', '07 + 08'),
  MOD('6', 'Secure MCP, then the capstone', 20, 'Rotate a device secret mid-session and watch the next call fail. The capstone is homework.', '09 + 10'),
];
const fromFull = (ch, to, types) =>
  SLIDES.filter((s) => s.ch === ch && types.includes(s.type)).map((s) => ({
    ...s,
    ch: to,
    title: s.title.replace(`chapter ${ch}`, `module ${to}`),
  }));
const cutNote = (m, cut) => `Covers full-track chapters ${m.covers}. Cut for time: ${cut}`;

const LITE_SLIDES = [
  { ...SLIDES.find((s) => s.type === 'title'), subtitle: 'Lab companion, LITE track · six modules · NestJS 12 · drizzle · Passport · MCP · Docker' },
  ...SLIDES.filter((s) => s.type === 'flow' || s.type === 'rules'),
  { type: 'agenda', title: 'The lite track (draft lab times)', notes: 'Six modules, about 170 minutes of labs plus the capstone as homework. Times are ESTIMATES: nobody has run these labs with an audience yet. The full track (ch00-ch10) has the labs this one cuts.' },

  { type: 'section', ch: '1', notes: cutNote(MODULES[0], 'the stack-persistence and clean-wipe demos (chapter 00).') },
  {
    type: 'run', ch: '1', title: 'Run this: stack up, then an orders resource',
    code: [
      'cd boilerplate/nest-ai-starter',
      'docker compose up -d --build',
      "alias dev='docker compose run --rm dev'",
      'dev pnpm verify                # 67 + 61 tests',
      '# write specs/orders.md (copy specs/notes.md), then:',
      'dev pnpm exec nest g resource orders --type rest --crud',
      'dev pnpm resource:template --name order --plural orders',
      "dev pnpm check:ai-fill         # your agent's to-do list",
      '# your agent fills every AI-FILL marker, then:',
      'dev pnpm verify',
    ],
    notes: 'The first image build takes a few minutes: use it to walk through docker-compose.yml and specs/notes.md. Learners give their agent the spec and the skill name (nest-resource-scaffold), not ad-hoc instructions.',
  },
  {
    type: 'checkpoint', ch: '1', title: 'Checkpoint: stack green, markers to zero',
    outputSource: 'captured, then expected',
    output: [
      '# docker compose ps -a  (STATUS)',
      'app       Up … (healthy)',
      'migrate   Exited (0)',
      '# dev pnpm verify (before your resource)',
      'Tests  67 passed (67)',
      'Tests  61 passed (61)',
      '# after the template step (captured)',
      'files written: 11;',
      'AI-FILL markers to complete: 16',
      '# after your agent (expected)',
      'AI-FILL markers: 0',
    ],
    done: [
      'app healthy, migrate exited 0, both gates green',
      'check:ai-fill prints 0 markers',
      'delete one service rule: exactly one test goes red',
    ],
  },
  {
    type: 'stuck', ch: '1', title: 'If you are stuck: module 1',
    rows: [
      ['A port is already in use', 'Something local owns 5432, 6379 or 3000. Stop it, or change the LEFT side of that `ports:` entry.'],
      ['"Run step 1 first"', 'The template script refuses before `nest g resource`, and refuses a second run. Never use --force after filling.'],
      ['Unit green, e2e red', 'Validation, defaults and status codes live at the HTTP boundary. Only e2e sees them.'],
    ],
  },

  { type: 'section', ch: '2', notes: cutNote(MODULES[1], 'nothing. This is chapter 02 as it stands.') },
  ...fromFull('02', '2', ['run', 'checkpoint', 'stuck']),

  { type: 'section', ch: '3', notes: cutNote(MODULES[2], 'reading the hand-written middleware commit (chapter 03) and the expiresAt lab (chapter 04). Offer expiresAt as a stretch.') },
  {
    type: 'run', ch: '3', title: 'Run this: break the 401, then rotate a key',
    code: [
      'curl -i localhost:3000/api/v1/auth/me     # 401',
      '# lab: give unknown emails a different message',
      'dev pnpm test:e2e         # which test fails? revert.',
      DEMO,
      'curl -s -H "Authorization: $DEMO_BASIC" \\',
      '  localhost:3000/api/v1/devices/$DEVICE_ID',
      'curl -s -X POST -H "Authorization: $DEMO_BASIC" \\',
      '  localhost:3000/api/v1/devices/$DEVICE_ID/credentials',
    ],
    notes: 'The helper prints exports only; keep the grep. Unfiltered, compose build-log lines run as shell commands (measured: they created stray files). The rotation output contains a NEW secret: do not paste it anywhere.',
  },
  {
    type: 'checkpoint', ch: '3', title: 'Checkpoint: one 401, one secret',
    outputSource: 'from the code, then expected',
    output: [
      'HTTP/1.1 401 Unauthorized',
      'WWW-Authenticate: Basic',
      '  realm="nest-ai-starter", charset="UTF-8"',
      '# after your change, e2e reports:',
      '× every failure is the SAME 401 …',
      '# GET device (expected)',
      '"status":"active", "secretLast4":"…"',
      '# POST …/credentials (expected)',
      '"secret":"dsk_…"   (shown ONCE)',
    ],
    done: [
      'you saw the test that pins the 401 rule fail, then reverted',
      'no response but /credentials ever shows a secret',
      "another user's device → 404, not 403",
    ],
  },
  {
    type: 'stuck', ch: '3', title: 'If you are stuck: module 3',
    rows: [
      ['"2 passed | 30 skipped", exit 1', 'A beforeAll threw (e.g. sign-up lost @Public()). The failure is on the Test Files line.'],
      ['My new route answers 401', 'Secure by default: the guard is global. Add @Public() only on purpose.'],
      ['Deleting a user gives a 500', 'Blocked FK deletes report 23001 (RESTRICT) or 23503 (NO ACTION). The adapter maps both to 409.'],
    ],
  },

  { type: 'section', ch: '4', notes: cutNote(MODULES[3], 'the separate envelope-discussion lab (chapter 05): the raw initialize below replaces it.') },
  { ...SLIDES.find((s) => s.type === 'run' && s.ch === '05'), ch: '4', title: 'Run this (1/2): a raw MCP initialize' },
  { ...SLIDES.find((s) => s.type === 'run' && s.ch === '06'), ch: '4', title: 'Run this (2/2): add a publish-note tool' },
  {
    type: 'checkpoint', ch: '4', title: 'Checkpoint: JSON-RPC in SSE, rule over MCP',
    outputSource: 'captured',
    output: [
      'content-type: text/event-stream',
      'event: message',
      'data: {"result":{"protocolVersion":…},',
      ' "jsonrpc":"2.0","id":1}',
      '# publish-note on a note with no body',
      '{"content":[{"type":"text","text":',
      '  "RULE_VIOLATION: A published note',
      '   needs a non-empty body"}],',
      ' "isError":true}',
    ],
    done: [
      'you matched the response id to the request',
      'the stdio e2e tool list updated on purpose',
      'tool error (isError) vs protocol error (error)',
    ],
  },
  {
    type: 'stuck', ch: '4', title: 'If you are stuck: module 4',
    rows: [
      ['401 on /mcp', 'Missing headers, a draft or archived device, or a rotated secret: one 401 for all. Re-run the helper.'],
      ['console.log "for debugging"', 'It goes into the protocol stream. The SDK client ignores it, so only the RAW stdout test fails.'],
      ['A crash instead of isError', 'Wrap tool bodies in runTool(): DomainError → tool error the model can read.'],
    ],
  },

  { type: 'section', ch: '5', notes: cutNote(MODULES[4], 'the Host-header lab (chapter 08). Mention MCP_ALLOWED_HOSTS; the stuck slide covers its snags.') },
  {
    type: 'run', ch: '5', title: 'Run this: a CI check, then the wire',
    code: [
      'dev pnpm build',
      'dev pnpm mcp:inspect:cli --method tools/call \\',
      '  --tool-name get-note \\',
      '  --tool-arg id=00000000-0000-4000-8000-000000000000',
      'echo "exit: $?"',
      '# src/bootstrap/attach-mcp.ts: enableJsonResponse: true',
      'docker compose up -d --build app',
      '# re-run the module 4 initialize: what changed?',
      '# then revert enableJsonResponse',
    ],
    notes: 'The Inspector web UI binds 127.0.0.1 inside its container: use the CLI in Docker. Exit 5 comes from the tool\'s own isError, which is why it is a sound CI signal.',
  },
  {
    type: 'checkpoint', ch: '5', title: 'Checkpoint: exit 5, then two framings',
    outputSource: 'captured, then expected',
    output: [
      '{ "content": [ { "type": "text",',
      '  "text": "NOT_FOUND: Note … not found" } ],',
      '  "isError": true }',
      'exit: 5',
      '# enableJsonResponse: true (expected)',
      'content-type: application/json',
      '{"result":…}',
    ],
    done: [
      "a script that FAILS when create-note accepts `{title:'x', status:'published'}`",
      'both framings captured and compared',
      'MCP_ALLOWED_HOSTS explained in one sentence',
    ],
  },
  {
    type: 'stuck', ch: '5', title: 'If you are stuck: module 5',
    rows: [
      ['No such file dist/mcp-stdio.js', 'Build first: dev pnpm build.'],
      ['Sharing the Inspector UI URL', 'Don\'t: it carries MCP_INSPECTOR_API_TOKEN, which is a credential.'],
      ['Called by service name: 403', 'Add that name to MCP_ALLOWED_HOSTS (reproduced in Docker).'],
    ],
  },

  { type: 'section', ch: '6', notes: cutNote(MODULES[5], 'nothing from chapter 09; the chapter 10 capstone moves to homework.') },
  ...fromFull('09', '6', ['run', 'checkpoint', 'stuck']),
  { ...SLIDES.find((s) => s.type === 'capstone'), title: 'Capstone (homework): evidence, not claims' },
  SLIDES.find((s) => s.type === 'closing'),
];

const TRACKS = [
  { file: 'lab-companion', label: 'Lab companion', unit: 'CHAPTER', units: CHAPTERS, slides: SLIDES },
  { file: 'lab-companion-lite', label: 'Lab companion (lite)', unit: 'MODULE', units: MODULES, slides: LITE_SLIDES },
];

// ---- icons -----------------------------------------------------------------------
async function icon(name, color = 'FFFFFF') {
  const svg = renderToStaticMarkup(
    React.createElement(Fi[name], { size: 256, color: `#${color}` }),
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${png.toString('base64')}`;
}

// ---- pptx --------------------------------------------------------------------------
async function buildPptx(file, track) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
  pres.title = `${track.label}: Building Apps with AI Agents`;
  pres.author = 'edu-training';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

  const footer = (dark) => [
    { text: { text: FOOTER, options: { x: 0.5, y: 5.2, w: 7.5, h: 0.3, fontSize: 10, color: dark ? '94A3B8' : COL.muted, margin: 0 } } },
  ];
  const slideNo = (dark) => ({ x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: dark ? '94A3B8' : COL.muted, align: 'right' });

  pres.defineSlideMaster({
    title: 'TITLE', background: { color: COL.ink },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.6, y: 1.5, w: 8.8, h: 1.3, fontSize: 44, bold: true, color: COL.paper, valign: 'bottom', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.6, y: 2.95, w: 8.8, h: 0.9, fontSize: 18, color: COL.mint, valign: 'top', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'SECTION', background: { color: COL.ink },
    objects: [
      { placeholder: { options: { name: 'kicker', type: 'body', x: 0.6, y: 1.2, w: 6, h: 0.4, fontSize: 14, bold: true, color: COL.mint, charSpacing: 3, margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.6, y: 1.65, w: 8.8, h: 1.0, fontSize: 40, bold: true, color: COL.paper, valign: 'top', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'goal', type: 'body', x: 0.6, y: 2.8, w: 6.2, h: 1.2, fontSize: 18, color: COL.soft, valign: 'top', margin: 0 }, text: '' } },
      ...footer(true),
    ],
    slideNumber: slideNo(true),
  });
  pres.defineSlideMaster({
    title: 'CONTENT', background: { color: COL.paper },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.5, y: 0.3, w: 9.0, h: 0.75, fontSize: 32, bold: true, color: COL.text, valign: 'middle', margin: 0 }, text: '' } },
      ...footer(false),
    ],
    slideNumber: slideNo(false),
  });

  const icons = {
    check: await icon('FiCheck'),
    alert: await icon('FiAlertTriangle'),
    clock: await icon('FiClock', COL.ink),
    FiTerminal: await icon('FiTerminal'),
    FiCheckCircle: await icon('FiCheckCircle'),
    FiLock: await icon('FiLock'),
    arrow: await icon('FiArrowRight', COL.muted),
  };

  // The motif: a terminal window card.
  function terminal(slide, x, y, w, h, lines, opts = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: COL.ink }, line: { color: COL.ink }, objectName: 'terminal' });
    [COL.red, COL.amber, COL.mint].forEach((c, i) =>
      slide.addShape(pres.shapes.OVAL, { x: x + 0.2 + i * 0.2, y: y + 0.14, w: 0.12, h: 0.12, fill: { color: c }, line: { color: c } }),
    );
    if (opts.label) {
      slide.addText(opts.label, { x: x + 0.9, y: y + 0.06, w: w - 1.1, h: 0.28, fontSize: 10, color: COL.comment, align: 'right', margin: 0, isTextBox: true, fontFace: THEME.bodyFontFace });
    }
    const runs = lines.map((line, i) => {
      const isComment = /^\s*(#|\/\/)/.test(line);
      return { text: line === '' ? ' ' : line, options: { color: isComment ? COL.comment : COL.code, breakLine: i < lines.length - 1 } };
    });
    slide.addText(runs, { x: x + 0.25, y: y + 0.42, w: w - 0.5, h: h - 0.55, fontFace: CODE_FONT, fontSize: opts.fontSize ?? 14, valign: 'top', margin: 0, isTextBox: true, objectName: 'terminal-text' });
  }
  function badge(slide, x, y, d, color, img) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color } });
    slide.addImage({ data: img, x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  }
  const chap = (n) => track.units.find((c) => c.n === n);
  const md2runs = (s, base = {}) =>
    s.split('`').map((part, i) => ({ text: part, options: { ...base, ...(i % 2 ? { fontFace: CODE_FONT } : {}) } }));

  for (const s of track.slides) {
    let slide;
    if (s.type === 'title') {
      slide = pres.addSlide({ masterName: 'TITLE' });
      slide.addText(s.title, { placeholder: 'title' });
      slide.addText(s.subtitle, { placeholder: 'subtitle' });
      terminal(slide, 0.6, 4.05, 5.6, 0.85, ['$ docker compose run --rm dev pnpm verify'], { fontSize: 12 });
    } else if (s.type === 'section') {
      const c = chap(s.ch);
      slide = pres.addSlide({ masterName: 'SECTION' });
      slide.addText(`${track.unit} ${c.n}`, { placeholder: 'kicker' });
      slide.addText(c.title, { placeholder: 'title' });
      slide.addText(md2runs(c.goal), { placeholder: 'goal' });
      // lab-time card
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.3, y: 2.8, w: 2.2, h: 1.2, rectRadius: 0.1, fill: { color: COL.slate }, line: { color: COL.slate } });
      badge(slide, 7.5, 3.05, 0.7, COL.mint, icons.clock);
      slide.addText([{ text: `${c.minutes} min`, options: { fontSize: 22, bold: true, color: COL.paper, breakLine: true } }, { text: 'lab (draft)', options: { fontSize: 11, color: COL.soft } }], { x: 8.3, y: 2.95, w: 1.15, h: 0.9, valign: 'middle', margin: 0, isTextBox: true });
    } else if (s.type === 'run') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const long = Math.max(...s.code.flatMap((l) => l.split('\n')).map((l) => l.length));
      const lines = s.code.flatMap((l) => l.split('\n'));
      const fontSize = long > 66 || lines.length > 11 ? 12 : 14;
      terminal(slide, 0.5, 1.2, 9.0, 3.85, lines, { fontSize, label: `${track.unit.toLowerCase()} ${s.ch} · run this` });
    } else if (s.type === 'checkpoint') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      terminal(slide, 0.5, 1.2, 5.5, 3.85, s.output, { fontSize: 12, label: `output: ${s.outputSource}` });
      slide.addText('Done when', { x: 6.4, y: 1.2, w: 3.1, h: 0.45, fontSize: 20, bold: true, color: COL.text, margin: 0, isTextBox: true });
      s.done.forEach((d, i) => {
        const y = 1.8 + i * 1.05;
        badge(slide, 6.4, y, 0.42, COL.mint, icons.check);
        slide.addText(md2runs(d), { x: 6.95, y: y - 0.04, w: 2.55, h: 0.95, fontSize: 14, color: COL.text, valign: 'top', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'stuck') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      s.rows.forEach(([head, body], i) => {
        const y = 1.2 + i * 1.3;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9.0, h: 1.15, rectRadius: 0.08, fill: { color: COL.mist }, line: { color: COL.mist }, objectName: `snag-${i + 1}` });
        badge(slide, 0.75, y + 0.3, 0.55, COL.amber, icons.alert);
        slide.addText([{ text: head, options: { bold: true, fontSize: 16, color: COL.text, breakLine: true } }, ...md2runs(body, { fontSize: 14, color: COL.slate })], { x: 1.55, y: y + 0.1, w: 7.75, h: 0.95, valign: 'middle', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'flow') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const w = 1.62, gap = 0.22;
      s.steps.forEach(([head, body], i) => {
        const x = 0.5 + i * (w + gap);
        const fill = head === 'Fill' ? COL.mint : COL.ink;
        slide.addShape(pres.shapes.OVAL, { x: x + (w - 0.9) / 2, y: 1.45, w: 0.9, h: 0.9, fill: { color: fill }, line: { color: fill } });
        slide.addText(String(i + 1), { x: x + (w - 0.9) / 2, y: 1.45, w: 0.9, h: 0.9, fontSize: 28, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
        if (i < s.steps.length - 1) slide.addImage({ data: icons.arrow, x: x + w - 0.03, y: 1.78, w: 0.26, h: 0.26 });
        slide.addText(head, { x, y: 2.55, w, h: 0.45, fontSize: 18, bold: true, color: COL.text, align: 'center', margin: 0, isTextBox: true });
        slide.addText(body, { x, y: 3.05, w, h: 1.2, fontSize: 14, color: COL.slate, align: 'center', valign: 'top', margin: 0, isTextBox: true });
      });
      slide.addText('Repeatable work → tools.  Judgement → the agent, fenced in.', { x: 0.5, y: 4.45, w: 9, h: 0.45, fontSize: 16, italic: true, color: COL.muted, margin: 0, isTextBox: true });
    } else if (s.type === 'rules') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      s.rows.forEach(([ic, head, body], i) => {
        const y = 1.3 + i * 1.25;
        badge(slide, 0.5, y, 0.7, COL.ink, icons[ic]);
        slide.addText([{ text: md2runs(head).map((r) => r.text).join(''), options: { bold: true, fontSize: 18, color: COL.text, breakLine: true } }, ...md2runs(body, { fontSize: 14, color: COL.slate })], { x: 1.45, y: y - 0.1, w: 8.05, h: 1.05, valign: 'top', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'agenda') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const half = Math.ceil(track.units.length / 2);
      track.units.forEach((c, i) => {
        const col = i < half ? 0 : 1, row = i < half ? i : i - half;
        const x = 0.5 + col * 4.6, y = 1.25 + row * 0.62;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.4, h: 0.52, rectRadius: 0.06, fill: { color: COL.mist }, line: { color: COL.mist } });
        slide.addText([{ text: `${c.n}  `, options: { bold: true, color: COL.mint, fontFace: CODE_FONT } }, { text: c.title, options: { color: COL.text } }], { x: x + 0.15, y, w: 3.3, h: 0.52, fontSize: 14, valign: 'middle', margin: 0, isTextBox: true });
        slide.addText(`${c.minutes}'`, { x: x + 3.4, y, w: 0.85, h: 0.52, fontSize: 14, color: COL.muted, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'capstone') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      s.items.forEach((t, i) => {
        const col = i < 4 ? 0 : 1, row = i % 4;
        const x = 0.5 + col * 4.6, y = 1.3 + row * 0.92;
        badge(slide, x, y + 0.05, 0.42, COL.mint, icons.check);
        slide.addText([{ text: `${i + 1}. `, options: { bold: true } }, { text: t }], { x: x + 0.55, y, w: 3.85, h: 0.8, fontSize: 14, color: COL.text, valign: 'top', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'closing') {
      slide = pres.addSlide({ masterName: 'TITLE' });
      slide.addText(s.title, { placeholder: 'title' });
      const w = 1.62, gap = 0.17;
      s.chain.forEach((t, i) => {
        const x = 0.6 + i * (w + gap);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.0, w, h: 0.75, rectRadius: 0.08, fill: { color: i === s.chain.length - 1 ? COL.mint : COL.slate }, line: { color: COL.slate } });
        slide.addText(t, { x, y: 3.0, w, h: 0.75, fontSize: 14, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
      });
      slide.addText(s.next, { x: 0.6, y: 4.05, w: 8.8, h: 0.8, fontSize: 14, color: COL.soft, valign: 'top', margin: 0, isTextBox: true });
    }
    if (s.notes) slide.addNotes(s.notes);
  }

  await pres.writeFile({ fileName: file });
  if (process.env.APPLY_THEME_JS) {
    const { applyTheme } = require(process.env.APPLY_THEME_JS);
    await applyTheme(file, THEME);
  }
}

// ---- markdown (Marp) -----------------------------------------------------------------
function buildMarkdown(track) {
  const out = [
    '---',
    'marp: true',
    `title: '${track.label}: Building Apps with AI Agents'`,
    'paginate: true',
    `# Generated by build-lab-deck.mjs from the same source as ${track.file}.pptx.`,
    '# Edit the script, not this file.',
    '---',
    '',
    '',
  ];
  const chap = (n) => track.units.find((c) => c.n === n);
  // Tables padded the way prettier writes them, so the repo's format hook is a no-op.
  const table = (rows) => {
    const w = rows[0].map((_, c) => Math.max(3, ...rows.map((row) => row[c].length)));
    const line = (row) => `| ${row.map((cell, c) => cell.padEnd(w[c])).join(' | ')} |`;
    return [line(rows[0]), line(w.map((n) => '-'.repeat(n))), ...rows.slice(1).map(line)];
  };
  const fence = (lines) => ['```bash', ...lines.flatMap((l) => l.split('\n')), '```'];
  const page = [];
  for (const s of track.slides) {
    const p = [];
    if (s.type === 'title') p.push(`# ${s.title}`, '', `**${s.subtitle}**`);
    if (s.type === 'section') {
      const c = chap(s.ch);
      p.push(`<!-- _class: lead -->`, '', `**${track.unit} ${c.n}**`, '', `# ${c.title}`, '', c.goal, '', `⏱ ${c.minutes} min lab (draft estimate)`);
    }
    if (s.type === 'run') p.push(`## ${s.title}`, '', ...fence(s.code));
    if (s.type === 'checkpoint') {
      p.push(`## ${s.title}`, '', `_Output: ${s.outputSource}_`, '', ...fence(s.output), '', '**Done when**', '', ...s.done.map((d) => `- [ ] ${d}`));
    }
    if (s.type === 'stuck') p.push(`## ${s.title}`, '', ...s.rows.map(([h, b]) => `- **${h}**: ${b}`));
    if (s.type === 'flow') p.push(`## ${s.title}`, '', ...s.steps.map(([h, b], i) => `${i + 1}. **${h}**: ${b}`), '', '_Repeatable work → tools. Judgement → the agent, fenced in._');
    if (s.type === 'rules') p.push(`## ${s.title}`, '', ...s.rows.map(([, h, b]) => `- **${h}**: ${b}`));
    if (s.type === 'agenda') p.push(`## ${s.title}`, '', ...table([[track.unit === 'MODULE' ? 'mod' : 'ch', track.unit.toLowerCase(), 'lab'], ...track.units.map((c) => [c.n, c.title, `${c.minutes}'`])]));
    if (s.type === 'capstone') p.push(`## ${s.title}`, '', ...s.items.map((t, i) => `${i + 1}. ${t}`));
    if (s.type === 'closing') p.push(`# ${s.title}`, '', s.chain.join(' → '), '', s.next);
    if (s.notes) p.push('', `<!--\n${s.notes}\n-->`);
    page.push(p.join('\n'));
  }
  return out.join('\n') + page.join('\n\n---\n\n') + '\n';
}

for (const track of TRACKS) {
  writeFileSync(join(OUT, `${track.file}.md`), buildMarkdown(track));
  if (process.env.MD_ONLY === '1') continue; // Markdown only: no pptx rendering
  await buildPptx(join(OUT, `${track.file}.pptx`), track);
  console.log(`build-lab-deck: ${track.slides.length} slides → ${track.file}.pptx + ${track.file}.md`);
}
