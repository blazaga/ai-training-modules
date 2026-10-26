#!/usr/bin/env node
// Builds the lecturer's lab-companion deck in TWO formats from ONE source:
//   lab-companion.pptx  (PowerPoint)
//   lab-companion.md    (Marp-compatible Markdown; plain Markdown viewers work too)
// Both come from the SLIDES array below, so they cannot drift apart.
//
// Rebuild (any machine with Node; see README.md in this folder):
//   node build-lab-deck.mjs [outDir]
// Requires the npm packages pptxgenjs, react, react-dom, react-icons and sharp.
// Reads the Postman collection (POSTMAN_COLLECTION, default: the starter's postman/ folder)
// and fails if a slide names a folder or request the collection does not have.
// MD_ONLY=1 writes only the two Markdown files.
// Optional: APPLY_THEME_JS=/path/to/apply_theme.js also writes the colours into the
// .pptx theme, so PowerPoint's theme picker shows them.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pptxgen = require('pptxgenjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const Fi = require('react-icons/fi');

const OUT = process.argv[2] ?? '.';

// The Postman collection the labs use for every API call. Slides name its folders and
// requests; every name is checked against the file below, so a renamed request fails
// the build instead of leaving a slide that points at nothing.
const COLLECTION =
  process.env.POSTMAN_COLLECTION ??
  join(dirname(fileURLToPath(import.meta.url)), '../../../boilerplate/nest-ai-starter/postman/nest-ai-starter.postman_collection.json');
const PM = JSON.parse(readFileSync(COLLECTION, 'utf8'));
// [folderPrefix, [requestName, ...]] -> [{ folder, requests }], verified against the collection.
const postman = (...groups) =>
  groups.map(([prefix, names]) => {
    const f = PM.item.find((x) => x.name.startsWith(`${prefix} ·`));
    if (!f) throw new Error(`Postman folder "${prefix} ·" is not in ${COLLECTION}`);
    for (const n of names)
      if (!f.item.some((x) => x.name === n)) throw new Error(`Postman request "${n}" is not in folder "${f.name}"`);
    return { folder: f.name, requests: names };
  });
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
const POSTMAN = 'EF5B25'; // Postman orange, used only on the Postman panel
const INSPECTOR = '6D4AE8'; // the Inspector UI panel

// ---- the content ----------------------------------------------------------------
// Draft lab times are ESTIMATES, not measured with learners: adjust after a dry run.
// `outputSource` says where each checkpoint output came from:
//   captured      observed when running this code
//   from the code literal values from the source (not a captured terminal)
//   expected      what should appear; checking it IS part of the lab
const CH = (n, title, minutes, goal) => ({ n, title, minutes, goal });
const CHAPTERS = [
  CH('00', 'Setup: Node, pnpm, SQLite', 15, 'Install, migrate the SQLite file, start the app, run the gate.'),
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
const DEMO = `eval "$(node scripts/demo-device.mjs)"`;

// The MCP Inspector web UI (pnpm mcp:inspect:ui), steps as measured on 2.12.0.
const INSPECTOR_UI = {
  title: 'In the Inspector UI',
  steps: [
    'Add Servers → + Add manually',
    'streamable-http · http://localhost:3000/mcp → Add',
    'Settings → Custom Headers → + Add Header, twice',
    'X-Access-Key-Id and X-Secret-Key, then close',
    'Switch the card on: Connected',
    'Tools → whoami → Execute Tool',
  ],
};
const INSPECTOR_UP = [
  'pnpm mcp:inspect:ui      # leave it running',
  '# open the localhost:6274 URL it prints',
  '# in a second terminal:',
  DEMO,
  '# the values for the two headers:',
  'echo "$MCP_KEY_ID"',
  'echo "$MCP_SECRET"',
];
const UI_FAILED = ['The UI says Failed', 'Wrong or missing device headers. The 401 makes the Inspector try OAuth (404s in Network). Check Settings → Custom Headers.'];
const UI_NOTES =
  'The Inspector listens on loopback only (127.0.0.1:6274). Its URL carries an API token: a credential. The three example servers in its list can be ignored. Secret values: the helper prints them; never paste them anywhere but the header field.';

const SLIDES = [
  {
    type: 'title',
    title: 'Building Apps with AI Agents',
    subtitle: 'Lab companion · NestJS 12 · drizzle · SQLite · Passport · MCP',
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
      ['FiTerminal', 'Node 24 + pnpm', 'Every command runs in boilerplate/nest-ai-starter. `corepack enable` once puts pnpm on your PATH; otherwise write `corepack pnpm`.'],
      ['FiCheckCircle', 'Counts, not exit codes', 'Read "Tests N passed" AND "Test Files": a failed beforeAll shows 0 failures in the Tests line and exit 1.'],
      ['FiLock', 'Never share a secret', 'Device secrets, Basic credentials and Inspector URLs (they carry a token) stay in your terminal.'],
    ],
    notes:
      'Linux, macOS and WSL shells were the target. The `eval "$(…)"` lab helper needs a POSIX shell; on PowerShell, copy the printed values by hand. Not tested on PowerShell.',
  },
  {
    type: 'rules',
    title: 'Calling the API with Postman',
    rows: [
      ['FiDownload', 'Import one file', 'In the starter: `postman/nest-ai-starter.postman_collection.json`. baseUrl is http://localhost:3000; the first request in folder 03 signs up the demo user.'],
      ['FiPlay', 'Folders follow the labs', 'Numbered by chapter, and each name says the lite module. Every request has tests: read the Test Results tab, not just the status.'],
      ['FiLock', 'It stores a live secret', 'Issuing credentials saves the device secret in a collection variable. Never export or share the collection after a run.'],
    ],
    notes:
      'The Inspector CLI (chapters 07 and 09) stays in the terminal: it is a real MCP client, which is the point of those chapters.',
  },  {
    type: 'rules',
    title: 'Lab checks: is my lab done?',
    rows: [
      ['FiCheckSquare', 'One check per lab', '`pnpm lab 04` runs the check for lab 04, `pnpm lab` all of them. Done means `Test Files 1 passed` and every test green.'],
      ['FiTool', 'Build labs start red', 'Labs 01, 02, 04, 06 and 10 fail on the starter, because the feature is not there yet. They pass once you have built it.'],
      ['FiShield', 'Guard labs start green', 'Labs 03, 08 and 09 pass on the starter. Break the rule on purpose, watch the check fail, then put it back.'],
    ],
    notes:
      'The checks drive the app over HTTP and MCP and never import learner code, so they compile before the lab is done. The contracts are in test/labs/README.md in the starter. Reference solutions for facilitators are in docs/ai-agent-training/solutions/.',
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
    type: 'run', ch: '00', title: 'Run this: install, migrate, start',
    code: [
      'cd boilerplate/nest-ai-starter',
      'corepack enable && pnpm install',
      'cp .env.example .env',
      'pnpm build && pnpm db:migrate',
      'pnpm start          # leave it running',
      '',
      '# in a second terminal:',
      'pnpm verify',
    ],
    postman: postman(['00', ['Health']]),
    notes: 'While pnpm install runs, open .env.example: DATABASE_URL=file:./data/app.db is the whole database. db:migrate creates that file and applies drizzle/; the app never migrates a file database itself.',
  },
  {
    type: 'checkpoint', ch: '00', title: 'Checkpoint: app up, gate green',
    outputSource: 'captured (abridged)',
    output: [
      '# pnpm db:migrate',
      'db:migrate: ledger rows: 3',
      '# pnpm start',
      'Nest application successfully started',
      '# Postman: 00 › Health',
      '{"status":"ok"}',
      '# pnpm verify',
      'Tests  69 passed (69)',
      'Tests  61 passed (61)',
    ],
    done: [
      'data/app.db exists, ledger rows: 3 (read the ledger, not a log line)',
      'health answers {"status":"ok"}',
      'both Tests lines AND both "Test Files … passed"',
    ],
    notes: 'Counts are from the final starter. If a learner sees fewer tests, they are on an older commit.',
  },
  {
    type: 'stuck', ch: '00', title: 'If you are stuck: chapter 00',
    rows: [
      ['pnpm: command not found', 'Run `corepack enable`, or write `corepack pnpm` instead of `pnpm`.'],
      ['Port 3000 is already in use', 'Something local owns it. Stop it, or set PORT=3001 in .env and use that port everywhere (Postman baseUrl too).'],
      ['no such table: users', 'The file was never migrated: `pnpm build && pnpm db:migrate`, then start again.'],
    ],
  },
  // ---------------------------------------------------------------- ch01
  { type: 'section', ch: '01' },
  {
    type: 'run', ch: '01', title: 'Run this: add an orders resource',
    code: [
      '# 1. write specs/orders.md (copy specs/notes.md)',
      'pnpm exec nest g resource orders \\',
      '  --type rest --crud',
      'pnpm resource:template \\',
      '  --name order --plural orders',
      'pnpm check:ai-fill      # your to-do list',
      '# 2. your agent fills every AI-FILL marker',
      '#    from specs/orders.md',
      'pnpm verify',
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
      'Tests  N passed  (N > 69)',
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
      'pnpm check:migrations   # FAILS: drift',
      'pnpm db:generate        # READ the SQL',
      'pnpm check:migrations   # clean now',
      'pnpm verify',
      '# stop the app (Ctrl+C), then:',
      'pnpm build && pnpm db:migrate',
      'pnpm start',
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
      '# pnpm db:migrate (expected)',
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
      ['All tests pass, check fails', 'Correct: tests run on the MIGRATION SQL (in-memory SQLite), not your TypeScript table. Generate the migration.'],
      ['Drift test fails', 'The zod schema and the table must declare exactly the same fields, with the same TS names.'],
      ['The generated SQL says NOT NULL', 'SQLite refuses it on any table with rows (measured). Decide what happens to existing rows first, as drizzle/0002 does.'],
    ],
  },

  // ---------------------------------------------------------------- ch03
  { type: 'section', ch: '03' },
  {
    type: 'run', ch: '03', title: 'Run this: see the 401, then break it',
    code: [
      "git log --oneline --grep 'course(ch03'",
      '# send the Postman requests, then the lab:',
      '# change the message for unknown emails',
      'pnpm test:e2e     # which test fails?',
      '# re-send "Me: unknown email" in Postman too',
    ],
    postman: postman(['03', ['Sign up (public)', 'Me: no credentials → 401', 'Me: wrong password → the same 401', 'Me: unknown email → the same 401', 'Me (Basic auth)']]),
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
      '# Me (Basic auth): 200 OK, no password',
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
      '# send the Postman requests first, then the lab:',
      '# add expiresAt: spec → schema → table',
      '#   → migration → rule → tests',
      'pnpm verify',
      '# re-send "Issue credentials" = a rotation',
    ],
    postman: postman(['04', ['Create device', 'Issue credentials (secret shown once)', 'Activate device', 'Get device (no secret, no hash)']]),
    notes: 'The collection keeps the issued secret in a collection variable for the MCP folders. Remind learners it is a live credential.',
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
      ['"Cannot add a NOT NULL column"', 'Your migration hit existing rows (measured). Hand-edit: deal with those rows first, as drizzle/0002 does.'],
      ['Deleting a user gives a 500', 'A blocked delete reports `SQLITE_CONSTRAINT_TRIGGER` (RESTRICT) or `SQLITE_CONSTRAINT_FOREIGNKEY` (NO ACTION). Map both to 409.'],
      ['Another user\'s device is 404', 'By design: 404, not 403, so ids cannot be probed.'],
    ],
  },

  // ---------------------------------------------------------------- ch05
  { type: 'section', ch: '05' },
  {
    type: 'run', ch: '05', title: 'Run this: a raw MCP initialize',
    code: [],
    postman: postman(['05', ['initialize', 'tools/list', 'tools/call whoami', 'No device headers → 401']]),
    notes: 'Open the Body tab of initialize: one SSE event, `event: message` then `data: {...}`, and the Headers tab: X-Access-Key-Id / X-Secret-Key come from the variables 04 · Devices stored. Then ask: which id answers which request? Where is the SSE framing? What would a tool error look like vs a protocol error?',
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
      ['401 Unauthorized', 'Missing headers, a draft or archived device, or a rotated secret: one 401 for all. Re-send folder 04 · Devices.'],
      ['403 Invalid Host', 'You called the app by a name not in MCP_ALLOWED_HOSTS (default: localhost and 127.0.0.1 only).'],
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
    notes: 'Then: pnpm verify. The stdio e2e test pins the EXACT tool list, so it fails until they update it deliberately. That is the lesson.',
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
    type: 'run', ch: '07', title: 'Run this: the Inspector UI',
    code: INSPECTOR_UP,
    ui: INSPECTOR_UI,
    notes: UI_NOTES,
  },
  {
    type: 'run', ch: '07', title: 'Run this: the Inspector as a CI check',
    code: [
      'pnpm build',
      'pnpm mcp:inspect:cli --method tools/list',
      'pnpm mcp:inspect:cli --method tools/call \\',
      '  --tool-name get-note \\',
      '  --tool-arg id=00000000-0000-4000-8000-000000000000',
      'echo "exit: $?"',
    ],
    notes: 'The CLI is the scriptable half: its exit code is what makes it a CI check. The web UI (previous slide) is for exploring.',
  },
  {
    type: 'checkpoint', ch: '07', title: 'Checkpoint: a tool error is exit 5',
    outputSource: 'captured',
    output: [
      '{ "content": [ { "type": "text",',
      '  "text": "NOT_FOUND: Note … not found" } ],',
      '  "isError": true }',
      'exit: 5',
    ],
    done: [
      'the UI shows Connected, and whoami returns your device',
      "a script that FAILS when create-note accepts `{title:'x', status:'published'}`",
      'you know why this exit code is a SOUND signal',
    ],
    notes: 'Exit 5 comes from the tool\'s own isError, not from the absence of a crash. That is why it is safe to rely on here.',
  },
  {
    type: 'stuck', ch: '07', title: 'If you are stuck: chapter 07',
    rows: [
      ['No such file dist/mcp-stdio.js', 'Build first: pnpm build.'],
      UI_FAILED,
      ['Sharing the UI URL', 'Don\'t: it carries MCP_INSPECTOR_API_TOKEN, which is a credential.'],
    ],
  },

  // ---------------------------------------------------------------- ch08
  { type: 'section', ch: '08' },
  {
    type: 'run', ch: '08', title: 'Run this: JSON vs SSE on the wire',
    code: [
      '# 1. Postman 05 › initialize: note the',
      '#    Content-Type and the Body',
      '# 2. src/bootstrap/attach-mcp.ts:',
      '#      enableJsonResponse: true',
      '# stop the app (Ctrl+C), then:',
      'pnpm build && pnpm start',
      '# 3. re-send initialize: what changed?',
      '# 4. revert, rebuild',
    ],
    postman: postman(['05', ['initialize']], ['08', ['Foreign Host → 403']]),
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
      ['My fetch Host test passes 200', 'fetch silently replaces Host (measured). node:http, curl and Postman send it as written.'],
      ['Called by hostname: 403', 'Add that name to MCP_ALLOWED_HOSTS: localhost,<hostname> (measured: 403 without, 200 with).'],
    ],
  },

  // ---------------------------------------------------------------- ch09
  { type: 'section', ch: '09' },
  {
    type: 'run', ch: '09', title: 'Run this: rotate mid-session',
    code: [
      DEMO,
      'npx -y @modelcontextprotocol/inspector@2.12.0 \\',
      '  --cli http://localhost:3000/mcp \\',
      '  --method tools/call --tool-name whoami \\',
      '  --header "X-Access-Key-Id: $MCP_KEY_ID" \\',
      '  --header "X-Secret-Key: $MCP_SECRET"',
    ],
    postman: postman(['09', ['Rotate credentials', 'whoami with the OLD secret → 401', 'whoami with the NEW secret']]),
    notes: 'Two clients, two devices: the Inspector uses the helper\'s device, Postman its own. Rotating in Postman therefore does not break the Inspector call; that is a good question to ask. The rotation response contains the NEW secret: do not paste it anywhere.',
  },
  {
    type: 'checkpoint', ch: '09', title: 'Checkpoint: rotation bites immediately',
    outputSource: 'captured',
    output: [
      '# Inspector whoami',
      '"device": { … "status": "active" … },',
      '"owner":  { … "email": "demo@example.com" }',
      '# Postman 09 · Rotate mid-session',
      'Rotate credentials           200',
      'whoami with the OLD secret   401',
      'whoami with the NEW secret   200',
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
      'the migration and your edits, or why none',
      'unit + e2e counts; owner-check mutation result',
      'my-notes e2e: two devices of two users',
      'pnpm verify + pnpm lab 10: every line',
      'Inspector capture with headers (secret redacted)',
      'WORKLOG entry, with any corrections',
    ],
    notes: 'Distinction: a false statement found in a comment, skill, spec or this course, measured and corrected. Rework: "tests pass" without counts, or any credential in an artefact.',
  },
  {
    type: 'closing', title: 'What you built',
    chain: ['Node + SQLite', 'REST + drizzle', 'Auth', 'Devices', 'MCP server'],
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
  { ...SLIDES.find((s) => s.type === 'title'), subtitle: 'Lab companion, LITE track · six modules · NestJS 12 · drizzle · SQLite · Passport · MCP' },
  ...SLIDES.filter((s) => s.type === 'flow' || s.type === 'rules'),
  { type: 'agenda', title: 'The lite track (draft lab times)', notes: 'Six modules, about 170 minutes of labs plus the capstone as homework. Times are ESTIMATES: nobody has run these labs with an audience yet. The full track (ch00-ch10) has the labs this one cuts.' },

  { type: 'section', ch: '1', notes: cutNote(MODULES[0], 'the persistence and clean-wipe demos (chapter 00).') },
  {
    type: 'run', ch: '1', title: 'Run this: set up, then an orders resource',
    code: [
      'cd boilerplate/nest-ai-starter',
      'corepack enable && pnpm install',
      'cp .env.example .env',
      'pnpm build && pnpm db:migrate',
      'pnpm verify                # 69 + 61 tests',
      '# write specs/orders.md (copy specs/notes.md), then:',
      'pnpm exec nest g resource orders --type rest --crud',
      'pnpm resource:template --name order --plural orders',
      "pnpm check:ai-fill         # your agent's to-do list",
      '# your agent fills every AI-FILL marker, then:',
      'pnpm verify',
    ],
    notes: 'While pnpm install runs, walk through specs/notes.md. Learners give their agent the spec and the skill name (nest-resource-scaffold), not ad-hoc instructions.',
  },
  {
    type: 'checkpoint', ch: '1', title: 'Checkpoint: gate green, markers to zero',
    outputSource: 'captured, then expected',
    output: [
      '# pnpm db:migrate',
      'db:migrate: ledger rows: 3',
      '# pnpm verify (before your resource)',
      'Tests  69 passed (69)',
      'Tests  61 passed (61)',
      '# after the template step (captured)',
      'files written: 11;',
      'AI-FILL markers to complete: 16',
      '# after your agent (expected)',
      'AI-FILL markers: 0',
    ],
    done: [
      'ledger rows: 3, both gates green',
      'check:ai-fill prints 0 markers',
      'delete one service rule: exactly one test goes red',
    ],
  },
  {
    type: 'stuck', ch: '1', title: 'If you are stuck: module 1',
    rows: [
      ['pnpm: command not found', 'Run `corepack enable`, or write `corepack pnpm` instead of `pnpm`.'],
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
      '# send folder 03, then the lab:',
      '# unknown emails get a different message',
      'pnpm test:e2e   # which test fails?',
      '# re-send 03 in Postman, then revert',
      '# then send folder 04',
    ],
    postman: postman(
      ['03', ['Sign up (public)', 'Me: no credentials → 401', 'Me: unknown email → the same 401', 'Me (Basic auth)']],
      ['04', ['Create device', 'Issue credentials (secret shown once)', 'Activate device', 'Get device (no secret, no hash)']],
    ),
    notes: 'Issuing credentials stores a live secret in a collection variable: never export or share the collection after a run. Re-sending Issue credentials is a rotation.',
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
      ['Deleting a user gives a 500', 'A blocked delete reports `SQLITE_CONSTRAINT_TRIGGER` (RESTRICT) or `SQLITE_CONSTRAINT_FOREIGNKEY` (NO ACTION). Map both to 409.'],
    ],
  },

  { type: 'section', ch: '4', notes: cutNote(MODULES[3], 'the separate envelope-discussion lab (chapter 05): the raw initialize below covers it.') },
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
    type: 'run', ch: '5', title: 'Run this (1/2): the Inspector UI',
    code: INSPECTOR_UP,
    ui: INSPECTOR_UI,
    notes: UI_NOTES,
  },
  {
    type: 'run', ch: '5', title: 'Run this (2/2): a CI check, then the wire',
    code: [
      'pnpm build',
      'pnpm mcp:inspect:cli --method tools/call \\',
      '  --tool-name get-note \\',
      '  --tool-arg id=00000000-0000-4000-8000-000000000000',
      'echo "exit: $?"',
      '# attach-mcp.ts: enableJsonResponse: true',
      '# restart the app: Ctrl+C, then',
      'pnpm build && pnpm start',
      '# re-send Postman 05 › initialize: what changed?',
      '# then revert enableJsonResponse',
    ],
    postman: postman(['05', ['initialize']], ['08', ['Foreign Host → 403']]),
    notes: 'The CLI is the scriptable half of the Inspector. Exit 5 comes from the tool\'s own isError, which is why it is a sound CI signal.',
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
      'the Inspector UI shows Connected',
      "a script that FAILS when create-note accepts `{title:'x', status:'published'}`",
      'both framings captured and compared',
    ],
  },
  {
    type: 'stuck', ch: '5', title: 'If you are stuck: module 5',
    rows: [
      UI_FAILED,
      ['Sharing the Inspector UI URL', 'Don\'t: it carries MCP_INSPECTOR_API_TOKEN, which is a credential.'],
      ['Called by hostname: 403', 'Add that name to MCP_ALLOWED_HOSTS: localhost,<hostname> (measured: 403 without, 200 with).'],
    ],
  },

  { type: 'section', ch: '6', notes: cutNote(MODULES[5], 'nothing from chapter 09; the chapter 10 capstone moves to homework.') },
  ...fromFull('09', '6', ['run', 'checkpoint', 'stuck']),
  { ...SLIDES.find((s) => s.type === 'capstone'), title: 'Capstone (homework): evidence, not claims' },
  SLIDES.find((s) => s.type === 'closing'),
];

// The lab check each unit ends with (boilerplate/nest-ai-starter/test/labs/). Added to the
// unit's LAST run slide as a command, and to its checkpoint as the first done-when item.
const GUARD_LABS = new Set(['03', '08', '09']);
function withLabChecks(slides, labsByUnit) {
  const lastRun = new Map();
  slides.forEach((s, i) => s.type === 'run' && labsByUnit[s.ch] && lastRun.set(s.ch, i));
  return slides.map((s, i) => {
    const labs = labsByUnit[s.ch];
    if (!labs) return s;
    const cmd = `pnpm lab ${labs.join(' ')}`;
    const guard = labs.every((l) => GUARD_LABS.has(l));
    if (s.type === 'run' && lastRun.get(s.ch) === i) {
      const comment = guard ? '# green now; break it, see red, revert' : '# the lab check: all green?';
      return { ...s, code: [...s.code, `${cmd}   ${comment}`] };
    }
    if (s.type === 'checkpoint') return { ...s, done: [`\`${cmd}\`: every test passes`, ...s.done] };
    return s;
  });
}

const TRACKS = [
  { file: 'lab-companion', label: 'Lab companion', unit: 'CHAPTER', units: CHAPTERS,
    slides: withLabChecks(SLIDES, { '01': ['01'], '02': ['02'], '03': ['03'], '04': ['04'], '06': ['06'], '08': ['08'], '09': ['09'] }) },
  { file: 'lab-companion-lite', label: 'Lab companion (lite)', unit: 'MODULE', units: MODULES,
    slides: withLabChecks(LITE_SLIDES, { '1': ['01'], '2': ['02'], '3': ['03', '04'], '4': ['06'], '5': ['08'], '6': ['09'] }) },
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
    FiDownload: await icon('FiDownload'),
    FiCheckSquare: await icon('FiCheckSquare'),
    FiTool: await icon('FiTool'),
    FiShield: await icon('FiShield'),
    FiPlay: await icon('FiPlay'),
    pm: await icon('FiSend', COL.paper),
    ui: await icon('FiMonitor', COL.paper),
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
  // Largest code size at which the longest line and every line fit (Courier: 0.6em wide).
  function fitCode(lines, w, h) {
    const long = Math.max(...lines.map((l) => l.length));
    return [14, 12, 11, 10].find((fs) => (long * fs * 0.6) / 72 <= w && (lines.length * fs * 1.2) / 72 <= h) ?? 10;
  }
  // The Postman panel: which folder, which requests, in order.
  function postmanCard(slide, x, y, w, h, groups, opts = {}) {
    const color = opts.color ?? POSTMAN;
    const title = opts.title ?? 'In Postman';
    const img = opts.icon ?? icons.pm;
    const wide = w > 5;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color }, line: { color }, objectName: opts.title ? 'inspector-ui' : 'postman' });
    slide.addImage({ data: img, x: x + 0.2, y: y + 0.17, w: 0.26, h: 0.26 });
    slide.addText(title, { x: x + 0.55, y: y + 0.12, w: w - 0.75, h: 0.36, fontSize: wide ? 18 : 16, bold: true, color: COL.paper, margin: 0, isTextBox: true });
    const fs = wide ? 16 : 13;
    const runs = [];
    groups.forEach((g, gi) => {
      if (g.folder) runs.push({ text: g.folder, options: { bold: true, fontSize: fs, color: COL.paper, breakLine: true, paraSpaceBefore: gi ? 6 : 0 } });
      g.requests.forEach((r, ri) =>
        runs.push({ text: `${ri + 1}. ${r}`, options: { fontSize: fs, color: COL.paper, breakLine: !(gi === groups.length - 1 && ri === g.requests.length - 1) } }),
      );
    });
    slide.addText(runs, { x: x + 0.2, y: y + 0.6, w: w - 0.4, h: h - 0.75, valign: 'top', margin: 0, isTextBox: true, objectName: 'postman-requests' });
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
      terminal(slide, 0.6, 4.05, 5.6, 0.85, ['$ pnpm verify'], { fontSize: 12 });
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
      const lines = s.code.flatMap((l) => l.split('\n'));
      const panel = s.postman ?? (s.ui ? [{ folder: '', requests: s.ui.steps }] : undefined);
      const pmW = panel ? (lines.length ? 3.1 : 9.0) : 0;
      if (lines.length) {
        const termW = panel ? 9.0 - pmW - 0.2 : 9.0;
        terminal(slide, 0.5, 1.2, termW, 3.85, lines, { fontSize: fitCode(lines, termW - 0.65, 3.3), label: `${track.unit.toLowerCase()} ${s.ch} · run this` });
      }
      if (s.postman) postmanCard(slide, 0.5 + 9.0 - pmW, 1.2, pmW, 3.85, s.postman);
      else if (s.ui) postmanCard(slide, 0.5 + 9.0 - pmW, 1.2, pmW, 3.85, panel, { title: s.ui.title, color: INSPECTOR, icon: icons.ui });
    } else if (s.type === 'checkpoint') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      terminal(slide, 0.5, 1.2, 5.5, 3.85, s.output, { fontSize: 12, label: `output: ${s.outputSource}` });
      slide.addText('Done when', { x: 6.4, y: 1.2, w: 3.1, h: 0.45, fontSize: 20, bold: true, color: COL.text, margin: 0, isTextBox: true });
      s.done.forEach((d, i) => {
        const y = 1.8 + i * (s.done.length > 4 ? 0.66 : s.done.length > 3 ? 0.8 : 1.05);
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
    if (s.type === 'run') {
      p.push(`## ${s.title}`);
      if (s.code.length) p.push('', ...fence(s.code));
      if (s.postman) p.push('', '**In Postman**', '', ...s.postman.map((g) => `- **${g.folder}**: ${g.requests.join(' · ')}`));
      if (s.ui) p.push('', `**${s.ui.title}**`, '', ...s.ui.steps.map((step, i) => `${i + 1}. ${step}`));
    }
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
