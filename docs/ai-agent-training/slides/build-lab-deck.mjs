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
// ---- the course: two modules ---------------------------------------------------------
// The same loop in each module (proctor → instruct → agent → check → review) and the same
// slides (divider, instructions, check it, checkpoint, when the agent goes wrong).
const MOD = (n, title, minutes, goal, covers) => ({ n, title, minutes, goal, covers });
const MODULES = [
  MOD('1', 'Users and notes', 60, 'Your agent sets the project up, then builds the users and notes resources (notes shareable between users) on the seeded tables.', '00 + 01 + 02'),
  MOD('2', 'An MCP server on your data', 45, 'Your agent builds an MCP server that reads and writes the database; you add it to your own Claude and ask it about the data.', '03 + 04'),
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
// Module 2 slide content, from the measured dry run (see the WORKLOG).
const MODULE2_EXPECT = [
  'reads the installed SDK, not its memory',
  'write tools call NotesService: no rule copied',
  'query read-only in two layers',
  'exits when data/app.db is missing',
];
const MODULE2_NOTES =
  'Measured: a fresh agent got lab 02 10/10 (lab 01 still 15/15) and verify 60 unit / 55 e2e. Its query guard has two layers, each proven by removing it: one SELECT/WITH statement (libSQL silently runs only the first of two), and a query_only connection (a delete hidden in a WITH emptied the copy without it). It also found that the default database path is relative to the working directory.';
const MODULE2_OUTPUT = [
  '# pnpm verify',
  'Tests  60 passed (60)',
  'Tests  55 passed (55)',
  '# pnpm lab 01 02',
  'Tests  25 passed (25)',
  '# query: delete from notes',
  'READ_ONLY: only a single SELECT',
  '(or WITH … SELECT) statement is allowed',
];
const MODULE2_STUCK = [
  ['query checks the SQL string only', 'A write can hide inside a WITH. Ask for a query_only connection too, and a test that tries it.'],
  ['Claude sees no tables', 'The server started in another folder and got an empty database. Use absolute paths; the server should exit when the file is missing.'],
  ['It copies the notes rules into the tools', 'One rule, two copies, one will drift. The tools should call NotesService.'],
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
      ['Check', 'pnpm verify + pnpm lab NN: read the counts'],
      ['Review', 'ask it to show, not tell: the red run, the SQL'],
    ],
    notes:
      'The AI does the building and the planning; the learner directs and checks. The instruction says what and when it is done, never how: the repo (CLAUDE.md, its skills, the specs) tells the agent how, and watching it find that out is part of the lab. Measured: fresh agents given only these instructions got every module\'s lab green. Hold the agent to evidence: counts, a failing run, the generated SQL.',
  },
  {
    type: 'lifecycle',
    title: 'NestJS: the path of one request',
    steps: [
      ['Client', 'Postman, curl, a browser'],
      ['Middleware', 'runs first, on the raw request: logging, CORS, headers'],
      ['Guards · Pipes', 'may it run? then parse the body: the global zod pipe, 400 if invalid'],
      ['Controller', 'the route: parse, delegate, return. No rules here'],
      ['Service', 'the rules (R1–R4); throws a DomainError when one is broken'],
      ['Repository', 'SQL through drizzle, behind a token'],
      ['SQLite', 'data/app.db; unique keys and foreign keys enforce too'],
    ],
    back: 'Response ←  a thrown DomainError is turned into 404 / 409 / 422 by DomainExceptionFilter, on the way back',
    notes: 'Middleware runs before Nest even picks the route, so it sees every request; guards and pipes run per route, then the controller. The controller never decides a business rule: it calls the service. The arrow back is the same for errors: services throw, the exception filter maps the error to one HTTP shape. In module 1 the learner\'s agent builds the controller, service and repository; the middleware, the global pipe and the filter already exist.',
  },
  {
    type: 'wiring',
    title: 'NestJS: how a module wires them',
    notes: 'A module is the unit nest g resource creates. It declares the controller and the providers; Nest creates each once and hands them to whoever asks in a constructor (dependency injection). The controller asks for the service, the service asks for the repository TOKEN, not a class, so the storage can be swapped in the module alone. Middleware is attached in a module too, with configure(consumer). AppModule imports every feature module.',
  },
  {
    type: 'rules',
    title: 'Three rules for the lab',
    rows: [
      ['FiTerminal', 'Node 24 + pnpm', 'Every command runs in boilerplate/nest-ai-starter. `corepack enable` once puts pnpm on your PATH; otherwise write `corepack pnpm`.'],
      ['FiCheckCircle', 'Counts, not exit codes', 'Read "Tests N passed" AND "Test Files": a failed beforeAll shows 0 failures in the Tests line and exit 1.'],
      ['FiDatabase', 'The data is yours to break', 'data/app.db ships seeded. Change it freely while you try things; `pnpm db:seed` puts it back, byte for byte.'],
    ],
    notes:
      'Linux, macOS and WSL shells were the target. Not tested on PowerShell.',
  },
  {
    type: 'rules',
    title: 'Calling the API with Postman',
    rows: [
      ['FiDownload', 'Import one file', 'In the starter: `postman/nest-ai-starter.postman_collection.json`. baseUrl is http://localhost:3000. Run the folders in order: 01 stores the ids 02 uses.'],
      ['FiPlay', 'Folders follow module 1', 'Users, then notes and sharing. Every request has tests: read the Test Results tab, not just the status.'],
      ['FiRefreshCw', 'It writes to your data', 'Requests create, change and delete rows in data/app.db. `pnpm db:seed` restores the seeded data.'],
    ],
    notes:
      'Module 2 has no Postman folder: its client is your own Claude (or the MCP Inspector), over stdio.',
  },  {
    type: 'rules',
    title: 'Lab checks: is my lab done?',
    rows: [
      ['FiCheckSquare', 'One check per lab', '`pnpm lab 01` runs the check for lab 01, `pnpm lab` all of them. Done means `Test Files 1 passed` and every test green.'],
      ['FiTool', 'Red until built', 'Every lab check fails on the starter, because its feature is not there yet. It turns green when your agent has built it, and stays green after.'],
      ['FiShield', 'Fell behind?', 'Start the next module from its checkpoint (docs/ai-agent-training/checkpoints/), not by patching your own copy.'],
    ],
    notes:
      'The checks drive the app over HTTP (lab 01, empty in-memory database) and the MCP server over stdio (lab 02, a copy of the seeded file), and never import learner code. The contracts are the specs; test/labs/README.md summarises them. Each module\'s reference result is a patch in docs/ai-agent-training/checkpoints/.',
  },

  {
    type: 'agenda',
    title: 'The track (draft lab times)',
    notes: 'Two modules, about 105 minutes of labs. Times are ESTIMATES: nobody has run these labs with an audience yet. Adjust after the first session.',
  },

  // ---------------------------------------------------------------- module 1
  { type: 'section', ch: '1', notes: cutNote(MODULES[0], 'nothing: the two stretch exercises of chapter 01 are for fast groups.') },
  {
    type: 'prompt', ch: '1', title: 'Instruction 1/3: set the project up',
    proctor: 'The data is already there. Have your agent set the project up, prove it works, and show you what is in the database.',
    prompt: WRAP('Set this project up on this machine and prove it works: counts, not "it works". Then show me what is in the database.'),
    expect: ['reads CLAUDE.md before running anything', 'counts: 20 unit, 2 e2e, a red lab 01', 'data: 25 users, 200 notes, 120 shares', 'switches to corepack pnpm if pnpm is missing'],
    notes: 'Measured: a fresh agent given only this instruction installed, built, started the app, and reported 20 unit / 2 e2e, lab 01 red, and the table counts (115 open and 85 done notes, 120 shares, none with its owner). If port 3000 is busy, PORT in .env (chapter 00).',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 2/3: the users resource',
    proctor: 'Do not tell your agent how. The repo says how resources are built; watch whether it finds that out.',
    prompt: WRAP('Build the users resource on the provided users table: specs/users.md. Done when pnpm verify is green.'),
    expect: ['finds the steps: generate, template, fill', 'keeps the provided table, 14 markers', 'no migration for a provided table', '409s left to the database, not re-coded'],
    notes: 'Measured: a fresh agent found the resource-spec and nest-resource-scaffold skills from CLAUDE.md on its own; the template kept users.table.ts and left 14 markers; verify went to 29 unit / 18 e2e. Lab 01 stays red until notes exist. Ask: which instruction told it to use the skill? None did.',
  },
  {
    type: 'prompt', ch: '1', title: 'Instruction 3/3: notes, with sharing',
    proctor: 'A user owns many notes; a note can be shared with many users. The rules decide where each piece goes.',
    prompt: WRAP('Now the notes resource, with sharing: specs/notes.md. Done when pnpm lab 01 and pnpm verify are green.'),
    expect: ['stored-state rules in the service (422)', 'filters and /shares routes, with e2e tests', 'a bad dueAt is 400, not 500', 'every rule broken once to see red'],
    notes: 'Measured: a fresh agent got lab 01 15/15 and verify 43 unit / 46 e2e. Its first dueAt answered 500 for "next tuesday" (zod 4 runs a transform after a failed format check); it found and fixed it. The filters and share routes go outside the markers, on purpose.',
  },
  {
    type: 'run', ch: '1', title: 'Check it: module 1',
    code: [
      'pnpm verify           # read both Tests lines',
      'pnpm build && pnpm start',
      '# second terminal: the seeded rows',
      "curl -s 'localhost:3000/api/v1/notes?status=done'",
    ],
    postman: postman(['01', ['List users (seeded)', 'Create user']], ['02', ['Create note', 'Edit a done note → 422 (R2)', 'Share with a friend']]),
    notes: 'The labs run on an empty in-memory database; this step proves the resources also serve the seeded rows. Then pnpm db:seed puts the data back.',
  },
  {
    type: 'checkpoint', ch: '1', title: 'Checkpoint: two MVCs on real data',
    outputSource: 'captured',
    output: [
      '# pnpm verify (base: 20 unit, 2 e2e)',
      'Tests  43 passed (43)',
      'Tests  46 passed (46)',
      '# pnpm lab 01',
      'Tests  15 passed (15)',
      '# the app on the seeded file',
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
      ['It runs db:generate for users', 'The table is provided: there is nothing to generate. pnpm verify (check:migrations) proves it.'],
      ['A bad dueAt answers 500', 'Zod 4 runs the transform after a failed datetime check. Guard it; the scaffold skill lists the trap.'],
      ['It counts notes before deleting a user', 'A second copy of a rule the foreign key already enforces. Let the database refuse; map the error.'],
    ],
  },

  // ---------------------------------------------------------------- module 2
  { type: 'section', ch: '2', notes: cutNote(MODULES[1], 'the stdio framing lab (chapter 03): reading one exchange covers it.') },
  {
    type: 'prompt', ch: '2', title: 'Instruction: an MCP server on your data',
    proctor: 'Your own Claude should be able to read and change this data. The model writes the SQL, so the server decides what may run.',
    prompt: WRAP('I want to use this data from my own Claude. Build the MCP server in specs/mcp.md. Done when pnpm lab 02 and pnpm verify are green; then tell me how to add it to Claude Code, and show me two questions I could ask it.'),
    expect: MODULE2_EXPECT,
    notes: MODULE2_NOTES,
  },
  {
    type: 'run', ch: '2', title: 'Check it: module 2',
    code: [
      'pnpm verify',
      'pnpm build',
      'claude mcp add notes-db -e DATABASE_URL="file:$PWD/data/app.db" \\',
      '  -- node "$PWD/dist/mcp-server.js"',
      '# then, in Claude: "Which open notes are',
      '#   shared with more than one person?"',
    ],
    notes: 'The lab runs the server on a COPY of data/app.db. When learners try it from Claude, the writes go to their own data/app.db: pnpm db:seed puts it back.',
  },
  {
    type: 'checkpoint', ch: '2', title: 'Checkpoint: your Claude, your data',
    outputSource: 'captured',
    output: MODULE2_OUTPUT,
    done: [
      'a write sent to query is READ_ONLY',
      'your Claude answers a question about the data',
    ],
  },
  {
    type: 'stuck', ch: '2', title: 'When the agent goes wrong: module 2',
    rows: MODULE2_STUCK,
  },
  {
    type: 'closing', title: 'What you built',
    chain: ['Seeded SQLite', 'Users', 'Notes + sharing', 'MCP server', 'Your Claude'],
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
    } else if (s.type === 'lifecycle') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      // One row of boxes left to right (the request), captions under them, one line back.
      const n = s.steps.length, gap = 0.16, w = (9.0 - gap * (n - 1)) / n, y = 1.35, h = 0.72;
      const fills = { Controller: COL.mint, Service: COL.mint, Repository: COL.mint };
      s.steps.forEach(([head, body], k) => {
        const x = 0.5 + k * (w + gap);
        const fill = fills[head] ?? (head === 'Client' || head === 'SQLite' ? COL.slate : COL.ink);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: `step-${k + 1}` });
        slide.addText(head, { x, y, w, h, fontSize: 12, bold: true, color: COL.paper, align: 'center', valign: 'middle', margin: 2, isTextBox: true });
        if (k < n - 1)
          slide.addShape(pres.shapes.LINE, { x: x + w, y: y + h / 2, w: gap, h: 0, line: { color: COL.muted, width: 1.5, endArrowType: 'triangle' } });
        slide.addText(body, { x, y: y + h + 0.12, w, h: 1.55, fontSize: 11, color: COL.slate, align: 'center', valign: 'top', margin: 0, isTextBox: true });
      });
      slide.addShape(pres.shapes.LINE, { x: 0.5 + w / 2, y: 3.85, w: 9.0 - w, h: 0, line: { color: COL.amber, width: 2, beginArrowType: 'triangle' } });
      slide.addText(s.back, { x: 0.5, y: 3.98, w: 9.0, h: 0.5, fontSize: 13, italic: true, color: COL.text, align: 'center', margin: 0, isTextBox: true });
      slide.addText('Mint: what your agent builds in module 1.  Dark: already in the base.', { x: 0.5, y: 4.55, w: 9.0, h: 0.35, fontSize: 12, color: COL.muted, margin: 0, isTextBox: true });
    } else if (s.type === 'wiring') {
      slide = pres.addSlide({ masterName: 'CONTENT' });
      slide.addText(s.title, { placeholder: 'title' });
      const box = (x, y, w, h, head, body, fill, name) => {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });
        slide.addText([{ text: head, options: { bold: true, fontSize: 13, color: COL.paper, breakLine: true } }, { text: body, options: { fontSize: 10, color: COL.paper } }], { x, y, w, h, align: 'center', valign: 'middle', margin: 3, isTextBox: true });
      };
      const arrow = (x, y, w, h, label, lx, ly, lw) => {
        slide.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: COL.muted, width: 1.5, endArrowType: 'triangle' } });
        if (label) slide.addText(label, { x: lx, y: ly, w: lw, h: 0.3, fontSize: 10, italic: true, color: COL.muted, margin: 0, isTextBox: true });
      };
      // AppModule on the left imports the feature module in the middle.
      box(0.5, 2.1, 1.7, 0.9, 'AppModule', 'imports every feature module', COL.slate, 'app-module');
      arrow(2.2, 2.55, 0.55, 0, 'imports', 2.2, 2.2, 0.6);
      // The feature module: a container with controller → service → repository inside.
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.8, y: 1.2, w: 3.6, h: 3.6, rectRadius: 0.1, fill: { color: COL.mist }, line: { color: COL.soft, width: 1 }, objectName: 'notes-module' });
      slide.addText('NotesModule  (src/notes/notes.module.ts)', { x: 2.95, y: 1.25, w: 3.3, h: 0.32, fontSize: 11, bold: true, color: COL.text, margin: 0, isTextBox: true });
      box(3.3, 1.65, 2.6, 0.8, 'NotesController', 'routes: parse, delegate, return', COL.mint, 'controller');
      arrow(4.6, 2.45, 0, 0.3, 'injects', 4.7, 2.47, 0.8);
      box(3.3, 2.75, 2.6, 0.8, 'NotesService', 'the rules; throws DomainError', COL.mint, 'service');
      arrow(4.6, 3.55, 0, 0.3, 'injects the token', 4.7, 3.57, 1.6);
      box(3.3, 3.85, 2.6, 0.8, 'DrizzleNotesRepository', 'provided for NOTES_REPOSITORY', COL.mint, 'repository');
      // Middleware on the right: attached in a module, runs before the controller.
      box(7.0, 1.65, 2.5, 0.8, 'Middleware', 'consumer.apply(fn).forRoutes(…)', COL.ink, 'middleware');
      slide.addShape(pres.shapes.LINE, { x: 5.9, y: 2.05, w: 1.1, h: 0, line: { color: COL.amber, width: 1.5, beginArrowType: 'triangle' } });
      slide.addText('runs first', { x: 6.05, y: 1.72, w: 0.9, h: 0.3, fontSize: 10, italic: true, color: COL.amber, margin: 0, isTextBox: true });
      box(7.0, 3.85, 2.5, 0.8, 'DatabaseModule', 'the DB token, global', COL.ink, 'database-module');
      slide.addShape(pres.shapes.LINE, { x: 5.9, y: 4.25, w: 1.1, h: 0, line: { color: COL.muted, width: 1.5, beginArrowType: 'triangle' } });
      slide.addText('Inject a token, not a class: the module decides the storage.', { x: 0.5, y: 4.88, w: 9.0, h: 0.3, fontSize: 12, italic: true, color: COL.muted, margin: 0, isTextBox: true });
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
    if (s.type === 'lifecycle') p.push(`## ${s.title}`, '', '```text', s.steps.map(([h]) => h).join(' → '), '```', '', ...s.steps.map(([h, b]) => `- **${h}**: ${b}`), '', `_${s.back}_`);
    if (s.type === 'wiring') p.push(`## ${s.title}`, '', '```text', 'AppModule ──imports──▶ NotesModule', '                         ├─ NotesController   (routes: parse, delegate, return)', '                         │     │ injects', '                         ├─ NotesService      (the rules; throws DomainError)', '                         │     │ injects the NOTES_REPOSITORY token', '                         └─ DrizzleNotesRepository ──▶ DatabaseModule (the DB token)', 'Middleware: consumer.apply(fn).forRoutes(…), runs before the controller', '```', '', '_Inject a token, not a class: the module decides the storage._');
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
