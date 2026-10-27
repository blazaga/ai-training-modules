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
// MD_ONLY=1 writes only the Markdown file.
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
const DEMO = `eval "$(node scripts/demo-device.mjs)"`;

// The MCP Inspector web UI (pnpm mcp:inspect:ui), steps as measured on 2.12.0.
const INSPECTOR_UI = {
  title: 'In the Inspector UI',
  steps: [
    'Add Servers → + Add manually',
    'streamable-http · http://localhost:3000/mcp → Add',
    'Settings → Custom Headers → + Add Header, twice',
    'X-Device-Key and X-Device-Secret, then close',
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
  'echo "$DEVICE_KEY"',
  'echo "$DEVICE_SECRET"',
];
const UI_FAILED = ['The UI says Failed', 'Wrong or missing device headers. The 401 makes the Inspector try OAuth (404s in Network). Check Settings → Custom Headers.'];
const UI_NOTES =
  'The Inspector listens on loopback only (127.0.0.1, ports 6274, 6275, 6278). Its startup output shows its API token twice, in the URL and on the Auth token line: both are a credential. The three example servers in its list can be ignored. Secret values: the helper prints them; never paste them anywhere but the header field.';

// ---- the course: six modules -------------------------------------------------------
// The same loop (spec → generate → template → fill → verify) and the same four slides per
// module (divider, run this, checkpoint, stuck). Each module covers one or two chapters and
// keeps ONE lab; the divider notes say what was left out, so a lecturer can offer it as a
// stretch.
const MOD = (n, title, minutes, goal, covers) => ({ n, title, minutes, goal, covers });
const MODULES = [
  MOD('1', 'Setup and the loop', 40, 'Your agent sets the project up, then adds an `orders` resource: spec → generate → template → fill → verify.', '00 + 01'),
  MOD('2', 'Data: drizzle and zod', 25, 'Your agent adds a `phone` column, generates the migration and tells you whether it is safe.', '02'),
  MOD('3', 'Identity: auth and devices', 45, 'Your agent adds Basic auth with Passport, moves it to JWT, then adds devices provisioned with a key and a secret.', '03 + 04'),
  MOD('4', 'Your first MCP server', 30, 'Your agent turns the notes service into MCP tools over stdio, then adds a `publish-note` tool.', '05 + 06'),
  MOD('5', 'Inspector and transports', 25, 'Your agent serves the same tools over HTTP at /mcp; you drive them with the Inspector.', '07 + 08'),
  MOD('6', 'Secure MCP, then the capstone', 20, 'Your agent locks /mcp to devices; you rotate a secret mid-session and watch the next call fail.', '09 + 10'),
];
const cutNote = (m, cut) =>
  `Covers chapter${m.covers.includes('+') ? 's' : ''} ${m.covers}. Left out for time: ${cut}`;

const SLIDES = [
  {
    type: 'title',
    title: 'Building Apps with AI Agents',
    subtitle: 'Lab companion · six modules · NestJS 12 · drizzle · SQLite · Passport · MCP',
    notes:
      'Keep this deck on screen during lab work. Each module has: a divider (goal + time), PROMPT slides (what the proctor says and the exact prompt learners paste into their agent), CHECK IT (what learners run to check the agent\'s work), CHECKPOINT (what correct looks like) and WHEN THE AGENT GOES WRONG (mistakes agents actually made). The full explanations are in the chapter documents.',
  },
  {
    type: 'flow',
    title: 'How every lab works',
    steps: [
      ['Proctor', 'the goal, where the requirements are, when it is done'],
      ['Instruct', 'you give that to your agent, never the steps'],
      ['Agent', 'works out how from the repo, then builds it'],
      ['Check', 'pnpm verify + pnpm lab NN: read the counts'],
      ['Review', 'ask it to show, not tell: the red run, the SQL'],
    ],
    notes:
      'The AI does the building and the planning; the learner directs and checks. The instruction says what and when it is done, never how: the repo (CLAUDE.md, its skills, the specs) tells the agent how, and watching it find that out is part of the lab. Measured: fresh agents given only these instructions got every module\'s lab green. Hold the agent to evidence: counts, a failing run, the generated SQL.',
  },
  {
    type: 'rules',
    title: 'Three rules for the lab',
    rows: [
      ['FiTerminal', 'Node 24 + pnpm', 'Every command runs in boilerplate/nest-ai-starter. `corepack enable` once puts pnpm on your PATH; otherwise write `corepack pnpm`.'],
      ['FiCheckCircle', 'Counts, not exit codes', 'Read "Tests N passed" AND "Test Files": a failed beforeAll shows 0 failures in the Tests line and exit 1.'],
      ['FiLock', 'Never share a secret', 'Passwords, tokens, device secrets and Inspector URLs (they carry a token) stay in your terminal.'],
    ],
    notes:
      'Linux, macOS and WSL shells were the target. The `eval "$(…)"` lab helper needs a POSIX shell; on PowerShell, copy the printed values by hand. Not tested on PowerShell.',
  },
  {
    type: 'rules',
    title: 'Calling the API with Postman',
    rows: [
      ['FiDownload', 'Import one file', 'In the starter: `postman/nest-ai-starter.postman_collection.json`. baseUrl is http://localhost:3000; the first request in folder 03 signs up the demo user.'],
      ['FiPlay', 'Folders follow the labs', 'Numbered by chapter, and each name says its module. Every request has tests: read the Test Results tab, not just the status.'],
      ['FiLock', 'It stores a live secret', 'Logging in saves a token and provisioning saves the device secret in collection variables. Never export or share the collection after a run.'],
    ],
    notes:
      'The Inspector CLI (chapters 07 and 09) stays in the terminal: it is a real MCP client, which is the point of those chapters.',
  },  {
    type: 'rules',
    title: 'Lab checks: is my lab done?',
    rows: [
      ['FiCheckSquare', 'One check per lab', '`pnpm lab 01` runs the check for lab 01, `pnpm lab` all of them. Done means `Test Files 1 passed` and every test green.'],
      ['FiTool', 'Red until built', 'Every lab check fails on the starter, because its feature is not there yet. It turns green when your agent has built it, and stays green after.'],
      ['FiShield', 'Fell behind?', 'Start the next module from its checkpoint (docs/ai-agent-training/checkpoints/), not by patching your own copy.'],
    ],
    notes:
      'The checks drive the app over HTTP and MCP and never import learner code, so they compile before the lab is done. The contracts are in test/labs/README.md in the starter. Each module\'s reference result is a patch in docs/ai-agent-training/checkpoints/.',
  },

  {
    type: 'agenda',
    title: 'The track (draft lab times)',
    notes: 'Six modules, about 170 minutes of labs plus the capstone as homework. Times are ESTIMATES: nobody has run these labs with an audience yet. Adjust after the first session.',
  },

  // ---------------------------------------------------------------- module 1
  { type: 'section', ch: '1', notes: cutNote(MODULES[0], 'the persistence and clean-wipe demos (chapter 00).') },
  {
    type: 'prompt', ch: '1', title: 'Instruction 1/2: set the project up',
    proctor: 'Have your agent set the project up and prove it works. You only read what it reports.',
    prompt: [
      'Set this project up on this machine and prove it works.',
      'Tell me what you ran and what you saw: counts, not "it',
      'works".',
    ],
    expect: ['reads CLAUDE.md before running anything', 'reports counts: ledger rows 1, 40 unit, 26 e2e', 'proves a check can fail (a planted error)', 'switches to corepack pnpm if pnpm is missing'],
    notes: 'Measured: a fresh agent given only this instruction set the project up, started the app, and reported ledger 1 / 40 unit / 26 e2e plus a red lab 01 as its baseline. If port 3000 is busy, PORT in .env (chapter 00).',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 2/2: an orders resource',
    proctor: 'Do not tell your agent how. The repo says how resources are built; watch whether it finds that out.',
    prompt: [
      'We need an orders resource. Its contract is section 01 of',
      'test/labs/README.md. Build it the way this repo builds',
      'resources. Done when pnpm lab 01 and pnpm verify are',
      'green. Report the counts, and anything the contract leaves',
      'undecided.',
    ],
    expect: ['specs/orders.md before any code', 'finds the repo\'s steps: generate, template, fill', 'O1 in the schema, O2 in the service', 'open questions recorded, no invented rules'],
    notes: 'Measured: a fresh agent found the resource-spec and nest-resource-scaffold skills from CLAUDE.md on its own, filled 14 markers, got lab 01 15/15 and verify green, and listed six open questions (reopening a fulfilled order first). Ask: which instruction told it to use the skill? None did.',
  },
  {
    type: 'run', ch: '1', title: 'Check it: module 1',
    code: [
      'pnpm check:ai-fill    # 0 markers left',
      'pnpm verify           # read both Tests lines',
      '# ask the agent: "delete rule O2, run',
      '#   pnpm exec vitest run src/orders, put it back"',
    ],
    postman: postman(['00', ['Health']]),
    notes: 'The mutation check proves the rule is tested: deleting O2 must turn a test red. Ask the agent to show the red run, not to describe it.',
  },
  {
    type: 'checkpoint', ch: '1', title: 'Checkpoint: the loop, closed',
    outputSource: 'captured',
    output: [
      '# setup: pnpm db:migrate',
      'db:migrate: ledger rows: 1',
      '# setup: pnpm verify',
      'Tests  40 passed (40)',
      'Tests  26 passed (26)',
      '# the template step',
      'files written: 11;',
      'AI-FILL markers to complete: 14',
      '# after the agent: pnpm verify',
      'Tests  47 passed (47)',
      'Tests  42 passed (42)',
    ],
    done: [
      'check:ai-fill prints 0 markers',
      'deleting O2 turns a test red',
    ],
  },
  {
    type: 'stuck', ch: '1', title: 'When the agent goes wrong: module 1',
    rows: [
      ['It says "done" without counts', 'Ask for the two `Tests` lines and the `Test Files` lines. A claim is not a count.'],
      ['It edited code outside the markers', 'Ask it to undo that and put the change in the template, or in a marker. Generated code stays generated.'],
      ['`it.each` fails typecheck (TS2322)', 'Known trap (in the skill): with supertest, write `async (x) => { await … }`.'],
    ],
  },

  // ---------------------------------------------------------------- module 2
  { type: 'section', ch: '2', notes: cutNote(MODULES[1], 'nothing. This is chapter 02 as it stands.') },
  {
    type: 'prompt', ch: '2', title: 'Instruction: a phone column',
    proctor: 'A schema change: the agent must read the migration it generates and tell you if it is safe.',
    prompt: [
      'Users need an optional phone number; the contract is',
      'section 02 of test/labs/README.md. Done when pnpm lab 02',
      'and pnpm verify are green. Before you finish, show me the',
      'database change and tell me whether it is safe on a',
      'database that already has users.',
    ],
    expect: ['the spec, then the schema, then the table', 'reads the generated SQL before calling it safe', 'tests the migration on a table with rows', 'ledger rows: 2'],
    notes: 'Measured: a fresh agent migrated a scratch database that already had a user, showed the row kept with phone null, and refused a NOT NULL column as a control. If yours only says "it is nullable, so it is safe", ask it to prove it.',
  },
  {
    type: 'run', ch: '2', title: 'Check it: module 2',
    code: [
      'git diff drizzle/        # one new migration',
      'pnpm db:migrate          # ledger rows: 2',
      'pnpm verify',
      '# restart the app (Ctrl+C), then:',
      'pnpm build && pnpm start',
    ],
    notes: 'The in-memory test database is built from the migration SQL, not the TypeScript table, so tests cannot catch a missing migration; check:migrations can.',
  },
  {
    type: 'checkpoint', ch: '2', title: 'Checkpoint: drift caught, ledger grows',
    outputSource: 'captured',
    output: [
      '# before db:generate',
      'check-migrations: DRIFT - tables',
      '  changed without a migration.',
      '# the generated SQL',
      'ALTER TABLE `users` ADD `phone` text;',
      '# pnpm db:migrate',
      'db:migrate: ledger rows: 2',
    ],
    done: [
      'you saw the drift failure first',
      'the agent explained why the SQL is safe',
    ],
  },
  {
    type: 'stuck', ch: '2', title: 'When the agent goes wrong: module 2',
    rows: [
      ['TS2345 "phone" is missing', 'Older specs build a user by hand: they need `phone: null` (the skill names this trap).'],
      ['All tests pass, the check fails', 'Correct: tests run on the MIGRATION SQL. The agent must run `pnpm db:generate`.'],
      ['It hand-wrote the SQL file', 'Ask it to delete that and generate: the snapshot in drizzle/meta must match.'],
    ],
  },

  // ---------------------------------------------------------------- module 3
  { type: 'section', ch: '3', notes: cutNote(MODULES[2], 'nothing; the expiresAt stretch needs /mcp, so it comes after module 6.') },
  {
    type: 'prompt', ch: '3', title: 'Instruction 1/3: Basic auth with Passport',
    proctor: 'First the simple handler: HTTP Basic, with Passport doing the protocol. No hand-written header parsing.',
    prompt: [
      'Callers must authenticate now. specs/auth.md is the',
      'design: do its step 1 only, keep pnpm verify green, and',
      'show me how to see it working.',
    ],
    expect: ['passport-http: no hand-written parser', 'a global guard; health and sign-up public', 'every e2e suite now signs in', 'shows you curl: 200 with, 401 without'],
    notes: 'Measured: a fresh agent built step 1 and demonstrated it with curl: 401 with a Basic challenge and one body for wrong password, unknown email and a bare header. Lab 03 stays red until step 2, by design.',
  },
  {
    type: 'prompt', ch: '3', title: 'Instruction 2/3: move to JWT',
    proctor: 'Now the better handler: the password crosses the wire once, at login; every other request carries a token that expires.',
    prompt: [
      'Now step 2 of specs/auth.md. Done when pnpm lab 03 and',
      'pnpm verify are green.',
    ],
    expect: ['JWT_SECRET the env-config way, never hard-coded', 'a jwt strategy that re-checks the user', 'Basic only on login', 'one 401 body, now with a Bearer challenge'],
    notes: 'Measured: a fresh agent got lab 03 8/8 from this one line, because the spec carries the design. Production must refuse to start without JWT_SECRET; check that your agent did not hard-code one.',
  },
  {
    type: 'prompt', ch: '3', title: 'Instruction 3/3: devices',
    proctor: 'A device is a non-human client. One call provisions it and returns its key and secret, shown once.',
    prompt: [
      'Add devices: specs/devices.md, and section 04 of',
      'test/labs/README.md. Done when pnpm lab 03 04 and pnpm',
      'verify are green.',
    ],
    expect: ['the scaffold skill, then reshaped for provision', 'reads the migration (ON DELETE restrict)', 'secret stored as a hash, shown once', 'another user\'s device is 404, not 403'],
    notes: 'Measured: a fresh agent scaffolded devices with the skill, reshaped the CRUD into provision, rotate and archive, and got lab 03 04 14/14. Break-it discussion: have it give unknown emails a different 401, watch lab 03 fail, revert.',
  },
  {
    type: 'run', ch: '3', title: 'Check it: module 3',
    code: [
      '# send Postman folder 03, then 04',
      'pnpm verify',
      '# restart the app (Ctrl+C), then:',
      'pnpm build && pnpm db:migrate && pnpm start',
    ],
    postman: postman(
      ['03', ['Sign up (public)', 'Log in: wrong password → 401', 'Log in: unknown email → the same 401', 'Log in (Basic) → token', 'Me (Bearer token)']],
      ['04', ['Provision device (key + secret shown once)', 'Get device (no secret, no hash)']],
    ),
    notes: 'Logging in stores a token, and provisioning a live device secret, in collection variables: never export or share the collection after a run.',
  },
  {
    type: 'checkpoint', ch: '3', title: 'Checkpoint: a token, one 401, one secret',
    outputSource: 'from the code, then expected',
    output: [
      '# Log in: unknown email',
      'HTTP/1.1 401 Unauthorized',
      'WWW-Authenticate: Basic',
      '  realm="nest-ai-starter", charset="UTF-8"',
      '# Log in (Basic) → token',
      '"tokenType":"Bearer","expiresIn":3600',
      '# Provision device',
      '"deviceKey":"DK…","secret":"dsk_…"',
      '# pnpm db:migrate',
      'db:migrate: ledger rows: 3',
    ],
    done: [
      'only provision and rotate ever show a secret',
      "another user's device → 404, not 403",
    ],
  },
  {
    type: 'stuck', ch: '3', title: 'When the agent goes wrong: module 3',
    rows: [
      ['It hand-writes a Basic parser', 'Point it at the spec: passport-http does the parsing. The colon limit is recorded, not worked around.'],
      ['Skipped tests, exit 1', 'A beforeAll threw (sign-up or login lost @Public()). The failure is on the Test Files line.'],
      ['A malformed Basic header gives 400', 'passport-http alone does that. The guard\'s handleRequest must turn every failure into the one 401.'],
    ],
  },

  // ---------------------------------------------------------------- module 4
  { type: 'section', ch: '4', notes: cutNote(MODULES[3], 'the separate envelope-discussion lab (chapter 05): reading one raw exchange covers it.') },
  {
    type: 'prompt', ch: '4', title: 'Instruction: an MCP server over stdio',
    proctor: 'The same services, now as tools an AI client can call. Stdout belongs to the protocol.',
    prompt: [
      'Make the notes service usable by AI clients over MCP,',
      'stdio first: module 4 of specs/mcp.md, plus the',
      'publish-note tool in section 06 of test/labs/README.md.',
      'Done when pnpm lab 06 and pnpm verify are green.',
    ],
    expect: ['reads the installed library, not its memory', 'tools call NotesService: no rules of their own', 'an e2e test that reads RAW stdout', 'publish-note reuses the published-needs-a-body rule'],
    notes: 'Measured: a fresh agent read the installed @rekog/mcp-nest types, got lab 06 4/4, and proved a stray console.log fails its raw-stdout test. Then look at the wire with pnpm mcp:inspect:cli and read chapter 05.',
  },
  {
    type: 'run', ch: '4', title: 'Check it: module 4',
    code: [
      'pnpm build',
      'pnpm mcp:inspect:cli --method tools/list',
      'pnpm mcp:inspect:cli --method tools/call \\',
      '  --tool-name get-note \\',
      '  --tool-arg id=00000000-0000-4000-8000-000000000000',
      'echo "exit: $?"',
    ],
    notes: 'The CLI is a real MCP client over stdio. Exit 5 comes from the tool\'s own isError, so it is a sound CI signal (module 5 uses it).',
  },
  {
    type: 'checkpoint', ch: '4', title: 'Checkpoint: errors the model can read',
    outputSource: 'captured',
    output: [
      '{ "content": [ { "type": "text",',
      '  "text": "NOT_FOUND: Note … not found" } ],',
      '  "isError": true }',
      'exit: 5',
    ],
    done: [
      'tools/list shows create-note, get-note, list-notes, publish-note',
      'a rule violation is a tool error, not a crash',
    ],
  },
  {
    type: 'stuck', ch: '4', title: 'When the agent goes wrong: module 4',
    rows: [
      ['A console.log "for debugging"', 'It goes into the protocol stream. The SDK client ignores it, so only the RAW stdout test catches it.'],
      ['It copied the zod schema into the tool', 'Two copies drift. Ask it to import the REST schema.'],
      ['Tool errors come back as exceptions', 'Wrap tool bodies in the tool-result helper: a DomainError must be `isError: true`.'],
    ],
  },

  // ---------------------------------------------------------------- module 5
  { type: 'section', ch: '5', notes: cutNote(MODULES[4], 'the Host-header lab (chapter 08). Mention MCP_ALLOWED_HOSTS; the stuck slide covers its snags.') },
  {
    type: 'prompt', ch: '5', title: 'Instruction: MCP over Streamable HTTP',
    proctor: 'Same tools, over HTTP, inside the app. No auth yet: name that state in a test, module 6 closes it.',
    prompt: [
      'Serve the same MCP tools over HTTP inside the app: module',
      '5 of specs/mcp.md. Done when pnpm lab 08 and pnpm verify',
      'are green.',
    ],
    expect: ['finds how the transport mounts on the app', 'MCP_ALLOWED_HOSTS the env-config way', 'the tools module imported by the app', 'a test that says /mcp is still open'],
    notes: 'Measured: a fresh agent got lab 08 4/4 and broke each setting once to see a test fail. Experiment: have it flip enableJsonResponse, compare initialize in Postman, watch lab 08 fail, revert.',
  },
  {
    type: 'run', ch: '5', title: 'Run this: the Inspector UI',
    code: INSPECTOR_UP,
    ui: INSPECTOR_UI,
    notes: UI_NOTES,
  },
  {
    type: 'run', ch: '5', title: 'Check it: module 5',
    code: [
      '# Postman 05 › initialize: an SSE stream',
      '# Postman 08 › Foreign Host → 403',
      'pnpm verify',
    ],
    postman: postman(['05', ['initialize']], ['08', ['Foreign Host → 403']]),
    notes: 'At this point the Inspector connects with no headers at all: that is the security finding module 6 fixes.',
  },
  {
    type: 'checkpoint', ch: '5', title: 'Checkpoint: one message, SSE framing',
    outputSource: 'captured',
    output: [
      'content-type: text/event-stream',
      'event: message',
      'data: {"result":{"protocolVersion":…},',
      ' "jsonrpc":"2.0","id":1}',
    ],
    done: [
      'tools listed over HTTP, the same as stdio',
      'a foreign Host is refused (403)',
    ],
  },
  {
    type: 'stuck', ch: '5', title: 'When the agent goes wrong: module 5',
    rows: [
      ['tools/list over HTTP is empty', 'McpToolsModule is not in AppModule (measured while building this course). Lab 08 checks for it.'],
      ['Called by hostname: 403', 'That name is not in MCP_ALLOWED_HOSTS: localhost,<hostname>.'],
      ['My fetch Host test passes 200', 'fetch silently replaces Host (measured). node:http, curl and Postman send it as written.'],
    ],
  },

  // ---------------------------------------------------------------- module 6
  { type: 'section', ch: '6', notes: cutNote(MODULES[5], 'nothing from chapter 09; the chapter 10 capstone moves to homework, and the expiresAt lab is a stretch.') },
  {
    type: 'prompt', ch: '6', title: 'Instruction: lock /mcp to devices',
    proctor: 'The transport authenticates, not the tools: a failure is an HTTP 401 before any JSON-RPC is read.',
    prompt: [
      'Only devices may use /mcp: module 6 of specs/mcp.md. Done',
      'when pnpm lab 09 and pnpm verify are green.',
    ],
    expect: ['middleware BEFORE the transport mounts', 'one 401 body for every failure', 'whoami: device and owner, public fields', 'proves the order matters by breaking it'],
    notes: 'Measured: a fresh agent got lab 09 4/4, and registering its middleware after the transport made lab 09 fail 3 tests. Discuss the known limit in the spec: a disabled user\'s devices keep working until archived.',
  },
  {
    type: 'run', ch: '6', title: 'Check it: rotate mid-session',
    code: [
      DEMO,
      'npx -y @modelcontextprotocol/inspector@2.12.0 \\',
      '  --cli http://localhost:3000/mcp \\',
      '  --method tools/call --tool-name whoami \\',
      '  --header "X-Device-Key: $DEVICE_KEY" \\',
      '  --header "X-Device-Secret: $DEVICE_SECRET"',
    ],
    postman: postman(['09', ['Rotate secret', 'whoami with the OLD secret → 401', 'whoami with the NEW secret']]),
    notes: 'Two clients, two devices: the Inspector uses the helper\'s device, Postman its own. Rotating in Postman therefore does not break the Inspector call; a good question to ask.',
  },
  {
    type: 'checkpoint', ch: '6', title: 'Checkpoint: rotation bites immediately',
    outputSource: 'captured',
    output: [
      '# Inspector whoami',
      '"device": { … "status": "active" … },',
      '"owner":  { … "email": "demo@example.com" }',
      '# Postman 09 · Rotate mid-session',
      'Rotate secret                200',
      'whoami with the OLD secret   401',
      'whoami with the NEW secret   200',
    ],
    done: [
      'the old secret failed on the NEXT call',
      'a user token on /mcp → 401',
    ],
  },
  {
    type: 'stuck', ch: '6', title: 'When the agent goes wrong: module 6',
    rows: [
      ['Calls without headers still work', 'The middleware is registered after the transport mounts. Move it before (measured: 2 e2e tests fail otherwise).'],
      ['It logs the headers to debug', 'Never: a device secret in a log is a leaked secret. Ask it to remove the line.'],
      ['The Inspector UI says Failed', 'Wrong or missing device headers. The 401 makes the Inspector try OAuth (404s in Network).'],
    ],
  },

  {
    type: 'capstone', title: 'Capstone (homework): evidence, not claims',
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

// The lab check each unit ends with (boilerplate/nest-ai-starter/test/labs/). Added to the
// unit's LAST run slide as a command, and to its checkpoint as the first done-when item.
const GUARD_LABS = new Set();
function withLabChecks(slides, labsByUnit) {
  const lastRun = new Map();
  slides.forEach((s, i) => s.type === 'run' && labsByUnit[s.ch] && lastRun.set(s.ch, i));
  return slides.map((s, i) => {
    const labs = labsByUnit[s.ch];
    if (!labs) return s;
    const cmd = `pnpm lab ${labs.join(' ')}`;
    const guard = labs.every((l) => GUARD_LABS.has(l));
    if (s.type === 'run' && lastRun.get(s.ch) === i && !s.code.some((l) => l.startsWith(cmd))) {
      const comment = guard ? '# green now; break it, see red, revert' : '# the lab check: all green?';
      return { ...s, code: [...s.code, `${cmd}   ${comment}`] };
    }
    if (s.type === 'checkpoint') return { ...s, done: [`\`${cmd}\`: every test passes`, ...s.done] };
    return s;
  });
}

// Module 3 builds auth (lab 03) and devices (lab 04). The expiresAt stretch is lab 12: it
// needs /mcp, so it follows module 6.
const TRACKS = [
  { file: 'lab-companion', label: 'Lab companion', unit: 'MODULE', units: MODULES,
    slides: withLabChecks(SLIDES, { '1': ['01'], '2': ['02'], '3': ['03', '04'], '4': ['06'], '5': ['08'], '6': ['09'] }) },
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
    const size = [14, 12, 11, 10].find((fs) => (long * fs * 0.6) / 72 <= w && (lines.length * fs * 1.2) / 72 <= h);
    // No silent fallback: at 10pt a longer line soft-wraps in the box and the next hard break
    // strands a word on its own line, which is unreadable in a prompt meant to be pasted.
    if (!size) throw new Error(`code block does not fit ${w}" x ${h}" even at 10pt: ${lines.length} lines, longest ${long} chars (max ${Math.floor((w * 72) / 6)}): "${lines.find((l) => l.length === long)}"`);
    return size;
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
    } else if (s.type === 'prompt') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      // The proctor's line, then the instruction card (the motif: a goal, where the requirements
      // are, and when it is done; never the steps), then what to watch for in the agent's approach.
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.15, w: 0.08, h: 0.6, fill: { color: COL.mint }, line: { color: COL.mint } });
      slide.addText([{ text: 'Proctor: ', options: { bold: true, color: COL.text } }, ...md2runs(s.proctor, { color: COL.slate })], { x: 0.7, y: 1.12, w: 8.8, h: 0.66, fontSize: 14, italic: true, valign: 'middle', margin: 0, isTextBox: true, objectName: 'proctor' });
      terminal(slide, 0.5, 1.9, 5.7, 3.15, s.prompt, { fontSize: fitCode(s.prompt, 5.05, 2.6), label: 'instruction · give it to your agent' });
      slide.addText('Watch its approach', { x: 6.45, y: 1.9, w: 3.05, h: 0.4, fontSize: 16, bold: true, color: COL.text, margin: 0, isTextBox: true });
      s.expect.forEach((e, i) => {
        const y = 2.4 + i * 0.66;
        badge(slide, 6.45, y + 0.04, 0.32, COL.mint, icons.check);
        slide.addText(md2runs(e), { x: 6.9, y, w: 2.6, h: 0.62, fontSize: 12, color: COL.text, valign: 'top', margin: 0, isTextBox: true });
      });
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
    if (s.type === 'prompt') {
      p.push(`## ${s.title}`, '', `> **Proctor:** ${s.proctor}`, '', '**Give it to your agent** (paste, or say it in your own words):', '', '```text', ...s.prompt, '```', '', '**Watch its approach**', '', ...s.expect.map((e) => `- ${e}`));
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
