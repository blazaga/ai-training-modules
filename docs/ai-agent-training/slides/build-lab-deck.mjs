#!/usr/bin/env node
// Builds the lecturer's lab-companion deck in TWO formats from ONE source:
//   lab-companion.pptx  (PowerPoint)
//   lab-companion.md    (Marp-compatible Markdown; plain Markdown viewers work too)
// Both come from the SLIDES array below, so they cannot drift apart.
//
// Rebuild (any machine with Node; see README.md in this folder):
//   node build-lab-deck.mjs [outDir]
// Requires the npm packages pptxgenjs, react, react-dom, react-icons and sharp.
// Reads the starter's playground request list (src/playground/requests.ts) and fails if a
// slide names a request the playground does not have.
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
// Screenshots live next to this script (img/), so the .md and the .pptx use the same files.
const HERE = dirname(fileURLToPath(import.meta.url));

// The playground page (GET /playground in the starter) lists the module 1 requests. Slides name
// them; every name is checked against src/playground/requests.ts, so a renamed request fails
// the build instead of leaving a slide that points at nothing.
const PLAYGROUND_SRC =
  process.env.PLAYGROUND_REQUESTS ??
  join(dirname(fileURLToPath(import.meta.url)), '../../../boilerplate/nest-ai-starter/src/playground/requests.ts');
const PLAYGROUND_NAMES = new Set([...readFileSync(PLAYGROUND_SRC, 'utf8').matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]));
const playground = (...names) => {
  for (const n of names) if (!PLAYGROUND_NAMES.has(n)) throw new Error(`Playground request "${n}" is not in ${PLAYGROUND_SRC}`);
  return names;
};
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
const PLAYGROUND = '0E7490'; // the playground panel
const INSPECTOR = '6D4AE8'; // the Inspector UI panel

// ---- the content ----------------------------------------------------------------
// Draft lab times are ESTIMATES, not measured with learners: adjust after a dry run.
// `outputSource` says where each checkpoint output came from:
//   captured      observed when running this code
//   from the code literal values from the source (not a captured terminal)
//   expected      what should appear; checking it IS part of the lab
// ---- the course: two modules ---------------------------------------------------------
// The same loop in each module (proctor → instruct → agent → check → review) and the same
// slides (divider, instructions, check it, checkpoint, when the agent goes wrong).
const MOD = (n, title, minutes, goal, covers) => ({ n, title, minutes, goal, covers });
const MODULES = [
  MOD('1', 'Users and notes', 15, 'Your agent sets the project up, then builds the users and notes resources (notes shareable between users) on the seeded tables.', '00 + 01 + 02'),
  MOD('2', 'An MCP server on your data', 15, 'Your agent builds an MCP server that queries and changes the database; you connect it to Claude Desktop and have Claude read and write your data.', '03 + 04'),
];
// An instruction as card lines: words unchanged, at most 58 characters per line (fitCode
// refuses a code block that does not fit, so a longer line would fail the build).
function WRAP(text, n = 58) {
  const out = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= n) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}
// The playground screenshot slide, from a dry run of "Check it: module 1" (see the WORKLOG):
// base + module 1 checkpoint, Run all in order in Chromium at 1280x720.
const SHOT_ALT = 'The playground after Run all in order: the four variables filled, Health and List users answered 200 with a check mark.';
const SHOT_POINTS = [
  '19 of 19 cards ✓ in our dry run',
  'Variables filled: the ids carry over',
  '409 and 422 cards ✓ too: the rule said no',
  'Red in DevTools for those: expected',
  'List users shows the 25 seeded users',
];
const SHOT_NOTES =
  'Captured in a dry run of the previous slide, in Chromium at 1280x720: base plus the module 1 checkpoint and no .env, verify 44 unit / 49 e2e, lab 01 15/15, then Run all in order: 19 of 19 cards green, no page errors, List users showing the 25 seeded users. With DevTools open the two 409 and three 422 requests show in red as failed loads; that is expected, they are the rule checks. If port 3000 is taken, npm start prints "successfully started" and THEN fails: the last line says the port is in use. Set PORT in .env and use that port in the URL. A missing .env does not matter: in development the app uses data/app.db by default. npm run db:seed puts the data back afterwards.';
// Module 2 slide content, from the measured dry run (see the WORKLOG).
const MODULE2_EXPECT = [
  'reads the installed SDK, not its memory',
  'typed write tools call the module 1 services',
  'query and execute each guarded in layers',
  'gives the Claude Desktop entry with absolute paths',
];
const MODULE2_NOTES =
  'Measured: a fresh agent got labs 31/31 and verify 46 unit / 58 e2e. Five SQL guards, each removed once and caught by lab 02: query is one SELECT/WITH statement (libSQL silently drops a second) run under PRAGMA query_only (a WITH can hide a delete); execute is one statement, only INSERT/UPDATE/DELETE, and UPDATE/DELETE need a WHERE. Its own e2e test missed two of the five: the lab checks come from the spec, not the code. The typed write tools call UsersService and NotesService, so removing a rule there turns the MCP checks red too. execute keeps foreign keys on but does not apply the service rules; its description says so.';
const MODULE2_OUTPUT = [
  '# npm run verify; npm run lab',
  'Tests  47 passed (47) · 58 passed (58)',
  'Tests  31 passed (31)',
  '# started as Claude Desktop does it',
  'create-user · create-note · share-note',
  'execute update … where id = … → 1 row',
  '# execute: delete from notes',
  'NOT_ALLOWED: DELETE without a WHERE …',
];
const MODULE2_STUCK = [
  ['query checks the SQL string only', 'A write can hide inside a WITH. Ask for PRAGMA query_only too, and a test that tries it.'],
  ['execute runs any SQL it is given', 'One statement, INSERT/UPDATE/DELETE only, a WHERE on UPDATE and DELETE. Ask for a test per refusal.'],
  ['Claude sees no tables', 'The server started in another folder and got an empty database. Use absolute paths; the server should exit when the file is missing.'],
  ['Claude Desktop shows no notes-db tools', 'A relative path or a bare node in the entry. Use the script\'s absolute paths, then quit Claude Desktop fully and reopen.'],
];
const cutNote = (m, cut) =>
  `Covers chapter${m.covers.includes('+') ? 's' : ''} ${m.covers}. Left out for time: ${cut}`;

const SLIDES = [
  {
    type: 'title',
    title: 'Building Apps with AI Agents',
    subtitle: 'Lab companion · two modules · NestJS 12 · drizzle · SQLite · MCP',
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
      ['Check', 'npm run verify + npm run lab NN: read the counts'],
      ['Review', 'ask it to show, not tell: the red run, the SQL'],
    ],
    notes:
      'The AI does the building and the planning; the learner directs and checks. The instruction says what and when it is done, never how: the repo (CLAUDE.md, its skills, the specs) tells the agent how, and watching it find that out is part of the lab. Measured: fresh agents given only these instructions got every module\'s lab green. Hold the agent to evidence: counts, a failing run, the generated SQL.',
  },
  {
    type: 'blockflow',
    title: 'NestJS: request flow',
    blocks: [
      ['Request', 'from the client'],
      ['Middleware', 'runs first'],
      ['Controller', 'the route'],
      ['Service', 'the rules'],
      ['Database', 'SQLite'],
    ],
    notes: 'Every request passes middleware first, then reaches a controller. The controller does no business logic: it calls a service. The service holds the rules and reads or writes the database (through a repository). The answer travels back the same way.',
  },
  {
    type: 'blockstack',
    title: 'NestJS: who calls whom',
    notes: 'A module groups one feature: its controller, its service and its repository. The controller calls the service; the service calls the repository; Nest connects them (dependency injection). Middleware sits outside the feature and runs before the controller. In module 1 your agent builds one module for users and one for notes.',
  },
  {
    type: 'rules',
    title: 'Three rules for the lab',
    rows: [
      ['FiTerminal', 'Windows, PowerShell, Node 24', 'Every command runs in boilerplate\\nest-ai-starter, one per line. npm ships with Node; scripts run as `npm run <name>`.'],
      ['FiCheckCircle', 'Counts, not exit codes', 'Read "Tests N passed" AND "Test Files": a failed beforeAll shows 0 failures in the Tests line and exit 1.'],
      ['FiDatabase', 'The data is yours to break', 'data/app.db ships seeded. Change it freely while you try things; `npm run db:seed` puts it back, byte for byte.'],
    ],
    notes:
      'The audience is on Windows. Windows PowerShell 5.1 has no && (PowerShell 7 does), so every command is on its own line. Nobody needs curl: the playground page sends the requests. The base starts its tools with node and their JS entry, because the node_modules\\.bin shims are .cmd files on Windows; measured on Linux, not yet on a Windows machine.',
  },
  {
    type: 'rules',
    title: 'Try it in the browser: /playground',
    rows: [
      ['FiGlobe', 'One page, every request', 'With the app running, open http://localhost:3000/playground. It lists every module 1 request: health, users, notes and sharing.'],
      ['FiPlay', 'Click to send', 'Each Send calls the real controller and shows the status, a ✓ when it is the one the specs expect, and the body. Run all in order chains the ids.'],
      ['FiRefreshCw', 'It writes to your data', 'Requests create, change and delete rows in data/app.db. `npm run db:seed` restores the seeded data.'],
    ],
    notes:
      'Before module 1 is built, health is the only green row: the rest answer 404 or wait for an id. Module 2 has no playground: its client is Claude Desktop, over stdio. The Postman collection stays in the starter (postman/) for anyone who prefers it; the labs do not use it.',
  },  {
    type: 'rules',
    title: 'Lab checks: is my lab done?',
    rows: [
      ['FiCheckSquare', 'One check per lab', '`npm run lab 01` runs the check for lab 01, `npm run lab` all of them. Done means `Test Files 1 passed` and every test green.'],
      ['FiTool', 'Red until built', 'Every lab check fails on the starter, because its feature is not there yet. It turns green when your agent has built it, and stays green after.'],
      ['FiShield', 'Fell behind?', 'Start the next module from its checkpoint (docs/ai-agent-training/checkpoints/), not by patching your own copy.'],
    ],
    notes:
      'The checks drive the app over HTTP (lab 01, empty in-memory database) and the MCP server over stdio (lab 02, a copy of the seeded file), and never import learner code. The contracts are the specs; test/labs/README.md summarises them. Each module\'s reference result is a patch in docs/ai-agent-training/checkpoints/.',
  },

  {
    type: 'agenda',
    title: 'The track (draft lab times)',
    notes: 'Two modules, about 15 minutes each for Claude Code to build, so about 30 minutes of labs. Times are ESTIMATES: nobody has run these labs with an audience yet. Adjust after the first session.',
  },

  // ---------------------------------------------------------------- module 1
  { type: 'section', ch: '1', notes: cutNote(MODULES[0], 'nothing: the two stretch exercises of chapter 01 are for fast groups.') },
  {
    type: 'run', ch: '1', title: 'Before you start: your local .env',
    code: [
      '# in boilerplate\\nest-ai-starter, BEFORE you start Claude Code',
      'Copy-Item .env.example .env',
      '',
      '# .env = your local settings: PORT, DATABASE_URL',
      '# git ignores it, so it stays on your machine',
      '# the app reads it on start: you and your agent',
      '#   run it with the same settings (tests never do)',
      '# port 3000 taken? change PORT in .env',
    ],
    notes: 'The repository ships .env.example: the variable names and safe defaults, never a secret. Each learner copies it to .env, which git ignores, so local changes such as a different PORT never get committed. Do it before starting Claude Code, so the agent finds it already in place: npm start, npm run db:migrate and the module 2 server (npm run mcp) read .env, whichever of you runs them. The tests and lab checks deliberately never read it: they use an empty in-memory database, so they cannot touch data/app.db. Without .env the app still serves data/app.db in development, but a changed port has nowhere to live.',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 1/3: set the project up',
    proctor: 'The data is already there. Have your agent set the project up, prove it works, and show you what is in the database.',
    prompt: WRAP('Set this project up on this machine and prove it works: counts, not "it works". Then show me what is in the database.'),
    expect: ['reads CLAUDE.md before running anything', 'counts: 21 unit, 5 e2e, a red lab 01', 'data: 25 users, 200 notes, 120 shares', 'passes script flags after --'],
    notes: 'Measured: a fresh agent given only this instruction installed, built, started the app, and reported 20 unit / 2 e2e (5 e2e now, with the playground\'s test), lab 01 red, and the table counts (115 open and 85 done notes, 120 shares, none with its owner). If port 3000 is busy, PORT in .env (chapter 00).',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 2/3: the users resource',
    proctor: 'Do not tell your agent how. The repo says how resources are built; watch whether it finds that out.',
    prompt: WRAP('Build the users resource on the provided users table: specs/users.md. Done when npm run verify is green.'),
    expect: ['finds the steps: generate, template, fill', 'keeps the provided table, 14 markers', 'no migration for a provided table', '409s left to the database, not re-coded'],
    notes: 'Measured: a fresh agent found the resource-spec and nest-resource-scaffold skills from CLAUDE.md on its own; the template kept users.table.ts and left 14 markers; verify went to 29 unit / 18 e2e. Lab 01 stays red until notes exist. Ask: which instruction told it to use the skill? None did.',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 3/3: notes, with sharing',
    proctor: 'A user owns many notes; a note can be shared with many users. The rules decide where each piece goes.',
    prompt: WRAP('Now the notes resource, with sharing: specs/notes.md. Done when npm run lab 01 and npm run verify are green.'),
    expect: ['stored-state rules in the service (422)', 'filters and /shares routes, with e2e tests', 'a bad dueAt is 400, not 500', 'every rule broken once to see red'],
    notes: 'Measured: a fresh agent got lab 01 15/15 and verify 43 unit / 46 e2e. Its first dueAt answered 500 for "next tuesday" (zod 4 runs a transform after a failed format check); it found and fixed it. The filters and share routes go outside the markers, on purpose.',
  },
  {
    type: 'run', ch: '1', title: 'Check it: module 1',
    code: [
      '# 1. the tests first',
      'npm run verify       # read both Tests lines',
      'npm run lab 01       # the lab check: all green?',
      '# 2. then the app on the seeded data',
      '#    (port taken? the last line says so: PORT= in .env)',
      'npm run build',
      'npm start',
      '# 3. open localhost:3000/playground (or your PORT)',
      '#    and click Run all in order',
    ],
    playground: playground('Health', 'List users (seeded)', 'Create user', 'Create note', 'Mark done', 'Edit a done note → 422 (R2)', 'Share with a friend'),
    notes: 'Tests first: verify and the lab check run on an empty in-memory database, so a green result there is the proof the code works. Only then start the app and open the playground: it sends every module 1 request to the running app with one click and shows each answer, proving the resources also serve the seeded rows. Nobody needs curl. The playground writes to data/app.db; npm run db:seed puts the data back.',
  },
  {
    type: 'screenshot', ch: '1', title: 'What to expect: the playground after Run all',
    image: 'img/playground-run-all.png',
    alt: SHOT_ALT,
    points: SHOT_POINTS,
    notes: SHOT_NOTES,
  },
  {
    type: 'checkpoint', ch: '1', title: 'Checkpoint: two MVCs on real data',
    outputSource: 'captured',
    output: [
      '# npm run verify (base: 21 unit, 5 e2e)',
      'Tests  44 passed (44)',
      'Tests  49 passed (49)',
      '# npm run lab 01',
      'Tests  15 passed (15)',
      '# /playground on the seeded file',
      'users total=25  notes total=200',
      'notes?status=done total=85',
    ],
    done: [
      'deleting a rule turns a test red',
      'the app lists the seeded rows',
    ],
  },
  {
    type: 'stuck', ch: '1', title: 'When the agent goes wrong: module 1',
    rows: [
      ['It runs db:generate for users', 'The table is provided: there is nothing to generate. npm run verify (check:migrations) proves it.'],
      ['A bad dueAt answers 500', 'Zod 4 runs the transform after a failed datetime check. Guard it; the scaffold skill lists the trap.'],
      ['It counts notes before deleting a user', 'A second copy of a rule the foreign key already enforces. Let the database refuse; map the error.'],
    ],
  },

  // ---------------------------------------------------------------- module 2
  { type: 'section', ch: '2', notes: cutNote(MODULES[1], 'the stdio framing lab (chapter 03): reading one exchange covers it.') },
  {
    type: 'restmcp', ch: '2',
    title: 'MCP next to REST: a second front door',
    notes:
      'Module 1 built the REST front door: an HTTP request reaches a controller, the controller calls a service, the service holds the rules. Module 2 adds a second front door for an AI client. The MCP server takes the controller\'s place: each tool parses its input and calls the SAME UsersService and NotesService, so the rules exist once. Measured: removing the never-shared-with-the-owner rule from NotesService turns both the REST tests and the MCP checks red. Two tools are the exception: query and execute run SQL a model wrote, straight on the database, so the server guards them itself. On the wire, MCP is JSON-RPC messages, not REST routes. They travel over a transport: stdio when Claude Desktop starts the server on your machine (what we build), or Streamable HTTP for a server you reach over the network. So MCP can ride on HTTP, but it is not built on REST.',
  },
  {
    type: 'prompt', ch: '2', title: 'Instruction: an MCP server on your data',
    proctor: 'The goal: your Claude Desktop app queries and changes this database. The model writes the SQL, so the server decides what may run.',
    prompt: WRAP('I want to use this data from Claude Desktop. Build the MCP server in specs/mcp.md. Done when npm run lab 02 and npm run verify are green; then show me how to connect it to Claude Desktop, one question I could ask it and one change I could ask it to make.'),
    expect: MODULE2_EXPECT,
    notes: MODULE2_NOTES,
  },
  {
    type: 'run', ch: '2', title: 'Check it: module 2',
    code: [
      'npm run verify',
      'npm run lab 02       # the lab check: all green?',
      'npm run build',
      'node scripts\\claude-desktop-config.mjs',
      '# paste the entry into the config file it names,',
      '# quit and reopen Claude Desktop, then ask:',
      '# "Which open notes are shared with more',
      '#   than one person?"',
      '# "Add a user Ada, ada@example.com, with',
      '#   a note due next Friday"',
    ],
    notes: 'Claude Desktop starts the server from its own folder with a minimal PATH, so the entry needs absolute paths for node, the server and the database: the script prints them. Quit Claude Desktop completely (not just the window) before reopening. The lab runs on a COPY of data/app.db; Claude Desktop writes to the real one, and npm run db:seed puts it back.',
  },
  {
    type: 'checkpoint', ch: '2', title: 'Checkpoint: Claude Desktop, your data',
    outputSource: 'captured',
    output: MODULE2_OUTPUT,
    done: [
      'query refuses a write, execute an unbounded one',
      'Claude Desktop answers a question and makes a change',
    ],
  },
  {
    type: 'stuck', ch: '2', title: 'When the agent goes wrong: module 2',
    rows: MODULE2_STUCK,
  },
  {
    type: 'closing', title: 'What you built',
    chain: ['Seeded SQLite', 'Users', 'Notes + sharing', 'MCP server', 'Claude Desktop'],
    next: 'Next: authentication before anyone else can reach it · an HTTP transport for a shared server · your own tables and tools',
    notes: 'Close by asking each learner for one thing their agent got wrong, and how they found out: a count, a red test, the SQL.',
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
    const cmd = `npm run lab ${labs.join(' ')}`;
    const guard = labs.every((l) => GUARD_LABS.has(l));
    if (s.type === 'run' && lastRun.get(s.ch) === i && !s.code.some((l) => l.startsWith(cmd))) {
      const comment = guard ? '# green now; break it, see red, revert' : '# the lab check: all green?';
      return { ...s, code: [...s.code, `${cmd}   ${comment}`] };
    }
    if (s.type === 'checkpoint') return { ...s, done: [`\`${cmd}\`: every test passes`, ...s.done] };
    return s;
  });
}

const TRACKS = [
  { file: 'lab-companion', label: 'Lab companion', unit: 'MODULE', units: MODULES,
    slides: withLabChecks(SLIDES, { '1': ['01'], '2': ['02'] }) },
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
    FiGlobe: await icon('FiGlobe'),
    FiDatabase: await icon('FiDatabase'),
    FiRefreshCw: await icon('FiRefreshCw'),
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
  // A side panel listing steps: the playground's requests, or the Inspector UI's steps.
  function panelCard(slide, x, y, w, h, groups, opts = {}) {
    const color = opts.color ?? PLAYGROUND;
    const title = opts.title ?? 'In the playground';
    const img = opts.icon ?? icons.pm;
    const wide = w > 5;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color }, line: { color }, objectName: opts.title ? 'inspector-ui' : 'playground' });
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
    slide.addText(runs, { x: x + 0.2, y: y + 0.6, w: w - 0.4, h: h - 0.75, valign: 'top', margin: 0, isTextBox: true, objectName: 'panel-steps' });
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
      terminal(slide, 0.6, 4.05, 5.6, 0.85, ['$ npm run verify'], { fontSize: 12 });
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
      const panel = s.playground ? [{ folder: 'localhost:3000/playground', requests: s.playground }] : s.ui ? [{ folder: '', requests: s.ui.steps }] : undefined;
      const pmW = panel ? (lines.length ? 3.1 : 9.0) : 0;
      if (lines.length) {
        const termW = panel ? 9.0 - pmW - 0.2 : 9.0;
        terminal(slide, 0.5, 1.2, termW, 3.85, lines, { fontSize: fitCode(lines, termW - 0.65, 3.3), label: `${track.unit.toLowerCase()} ${s.ch} · run this` });
      }
      if (s.playground) panelCard(slide, 0.5 + 9.0 - pmW, 1.2, pmW, 3.85, panel);
      else if (s.ui) panelCard(slide, 0.5 + 9.0 - pmW, 1.2, pmW, 3.85, panel, { title: s.ui.title, color: INSPECTOR, icon: icons.ui });
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
    } else if (s.type === 'blockflow') {
      // A simple block diagram: boxes left to right, one arrow between each.
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const n = s.blocks.length, gap = 0.45, w = (9.0 - gap * (n - 1)) / n, y = 2.0, h = 1.1;
      s.blocks.forEach(([head, sub], k) => {
        const x = 0.5 + k * (w + gap);
        const fill = head === 'Controller' || head === 'Service' ? COL.mint : COL.ink;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill }, objectName: `block-${k + 1}` });
        slide.addText(head, { x, y, w, h, fontSize: 16, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 2, isTextBox: true });
        slide.addText(sub, { x, y: y + h + 0.15, w, h: 0.4, fontSize: 13, color: COL.slate, align: 'center', margin: 0, isTextBox: true });
        if (k < n - 1)
          slide.addShape(pres.shapes.LINE, { x: x + w + 0.06, y: y + h / 2, w: gap - 0.12, h: 0, line: { color: COL.muted, width: 2, endArrowType: 'triangle' } });
      });
    } else if (s.type === 'blockstack') {
      // A simple block diagram: a module box holding controller → service → repository,
      // with middleware outside, pointing at the controller.
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const block = (x, y, w, h, label, fill, name) => {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill }, objectName: name });
        slide.addText(label, { x, y, w, h, fontSize: 16, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 2, isTextBox: true });
      };
      const down = (x, y) => slide.addShape(pres.shapes.LINE, { x, y, w: 0, h: 0.32, line: { color: COL.muted, width: 2, endArrowType: 'triangle' } });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.0, y: 1.15, w: 3.4, h: 3.75, rectRadius: 0.12, fill: { color: COL.mist }, line: { color: COL.soft, width: 1 }, objectName: 'module' });
      slide.addText('Module', { x: 4.15, y: 1.2, w: 3.1, h: 0.4, fontSize: 14, bold: true, color: COL.text, margin: 0, isTextBox: true });
      block(4.45, 1.65, 2.5, 0.75, 'Controller', COL.mint, 'controller');
      down(5.7, 2.43);
      block(4.45, 2.78, 2.5, 0.75, 'Service', COL.mint, 'service');
      down(5.7, 3.56);
      block(4.45, 3.91, 2.5, 0.75, 'Repository', COL.mint, 'repository');
      block(1.0, 1.65, 2.3, 0.75, 'Middleware', COL.ink, 'middleware');
      slide.addShape(pres.shapes.LINE, { x: 3.33, y: 2.03, w: 1.09, h: 0, line: { color: COL.muted, width: 2, endArrowType: 'triangle' } });
      block(8.0, 3.91, 1.5, 0.75, 'Database', COL.ink, 'database');
      slide.addShape(pres.shapes.LINE, { x: 6.98, y: 4.29, w: 0.99, h: 0, line: { color: COL.muted, width: 2, endArrowType: 'triangle' } });
    } else if (s.type === 'screenshot') {
      // A real screenshot (1280x720) on the left, what to look for on the right.
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const h = 3.75, w = (h * 16) / 9;
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.47, y: 1.17, w: w + 0.06, h: h + 0.06, fill: { color: COL.soft }, line: { color: COL.soft } });
      slide.addImage({ path: join(HERE, s.image), x: 0.5, y: 1.2, w, h, altText: s.alt });
      slide.addText('Look for', { x: 0.5 + w + 0.3, y: 1.2, w: 9.5 - (0.5 + w + 0.3), h: 0.4, fontSize: 16, bold: true, color: COL.text, margin: 0, isTextBox: true });
      s.points.forEach((pt, i) => {
        const y = 1.7 + i * Math.min(0.85, 3.3 / s.points.length);
        badge(slide, 0.5 + w + 0.3, y + 0.02, 0.3, COL.mint, icons.check);
        slide.addText(pt, { x: 0.5 + w + 0.7, y: y - 0.05, w: 9.5 - (0.5 + w + 0.7), h: 0.75, fontSize: 12, color: COL.slate, valign: 'top', margin: 0, isTextBox: true });
      });
    } else if (s.type === 'restmcp') {
      // Two front doors (REST controller, MCP tools) over the same services and database.
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const box = (x, y, w, h, label, fill, name, size = 15) => {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill }, objectName: name });
        slide.addText(label, { x, y, w, h, fontSize: size, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 2, isTextBox: true });
      };
      const arrow = (x, y, w, h, extra = {}) =>
        slide.addShape(pres.shapes.LINE, { x, y, w, h, ...extra, line: { color: COL.muted, width: 2, endArrowType: 'triangle', ...(extra.line ?? {}) } });
      const caption = (x, y, w, h, text, opts = {}) =>
        slide.addText(text, { x, y, w, h, fontSize: 11, color: COL.slate, margin: 0, isTextBox: true, ...opts });
      // lane captions
      caption(0.5, 1.0, 3.0, 0.3, 'REST · module 1', { bold: true, color: COL.text, fontSize: 12 });
      caption(6.5, 1.0, 3.0, 0.3, 'MCP · module 2', { bold: true, color: COL.text, fontSize: 12, align: 'right' });
      // clients
      box(0.5, 1.35, 3.0, 0.55, 'Browser · /playground', COL.ink, 'rest-client', 14);
      box(6.5, 1.35, 3.0, 0.55, 'Claude Desktop', COL.ink, 'mcp-client', 14);
      // wire
      arrow(2.0, 1.93, 0, 0.52);
      caption(2.15, 1.98, 1.6, 0.45, 'HTTP: GET /api/v1/notes', { fontSize: 10 });
      arrow(8.0, 1.93, 0, 0.52);
      caption(5.9, 1.98, 1.95, 0.45, 'JSON-RPC over stdio: tools/call', { fontSize: 10, align: 'right' });
      // the replaceable layer
      box(0.5, 2.5, 3.0, 0.65, 'Controller (routes)', COL.mint, 'controller');
      box(6.5, 2.5, 3.0, 0.65, 'MCP server (tools)', COL.amber, 'mcp-tools');
      // shared core
      arrow(2.0, 3.18, 2.0, 0.37);
      arrow(6.0, 3.18, 2.0, 0.37, { flipH: true });
      box(3.0, 3.55, 4.0, 0.6, 'Services: the rules (module 1)', COL.mint, 'services');
      arrow(5.0, 4.17, 0, 0.3);
      box(3.0, 4.5, 4.0, 0.5, 'Repository → data/app.db', COL.ink, 'database', 14);
      // the exception: raw SQL
      slide.addShape(pres.shapes.LINE, { x: 9.2, y: 3.18, w: 0, h: 1.57, line: { color: COL.amber, width: 1.5, dashType: 'dash' } });
      slide.addShape(pres.shapes.LINE, { x: 7.03, y: 4.75, w: 2.17, h: 0, flipH: true, line: { color: COL.amber, width: 1.5, dashType: 'dash', endArrowType: 'triangle' } });
      caption(7.2, 3.55, 1.9, 0.6, 'query · execute: SQL straight to the database, guarded by the server', { fontSize: 10 });
      // transport note
      caption(0.5, 3.6, 2.35, 1.4, 'Same services, same rules: MCP replaces the controller, not the app. MCP messages are JSON-RPC; the transport is stdio here (Claude Desktop starts the server) or Streamable HTTP for a remote server.', { fontSize: 10 });
    } else if (s.type === 'rules') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      s.rows.forEach(([ic, head, body], i) => {
        if (!icons[ic]) throw new Error(`icon ${ic} is used on "${s.title}" but not loaded in icons`);
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
      if (s.playground) p.push('', '**In the playground** (`localhost:3000/playground`)', '', ...s.playground.map((r, i) => `${i + 1}. ${r}`));
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
    if (s.type === 'blockflow') p.push(`## ${s.title}`, '', '```text', s.blocks.map(([h]) => `[${h}]`).join(' → '), '```', '', s.blocks.map(([h, sub]) => `**${h}**: ${sub}`).join(' · '));
    if (s.type === 'screenshot') p.push(`## ${s.title}`, '', `![${s.alt}](${s.image})`, '', ...s.points.map((pt) => `- ${pt}`));
    if (s.type === 'restmcp') p.push(`## ${s.title}`, '', '```text', 'REST · module 1                     MCP · module 2', '[Browser · /playground]            [Claude Desktop]', '   │ HTTP: GET /api/v1/notes           │ JSON-RPC over stdio: tools/call', '   ▼                                  ▼', '[Controller (routes)]              [MCP server (tools)] ┄┄┐ query · execute:', '          ╲                          ╱                  ┆ raw SQL, guarded', '           ▶ [Services: the rules] ◀                    ┆', '                    ▼                                   ┆', '         [Repository → data/app.db] ◀┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘', '```', '', 'Same services, same rules: MCP replaces the controller, not the app. MCP messages are JSON-RPC; the transport is stdio here (Claude Desktop starts the server) or Streamable HTTP for a remote server.');
    if (s.type === 'blockstack') p.push(`## ${s.title}`, '', '```text', '               ┌──────── Module ────────┐', '[Middleware] ──▶ │   [Controller]         │', '               │        ▼               │', '               │    [Service]           │', '               │        ▼               │', '               │   [Repository] ────────┼──▶ [Database]', '               └────────────────────────┘', '```');
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
