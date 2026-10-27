// `npm run playground:check [-- <group>] [-- --url http://localhost:3100]`
//
// Sends the playground's requests (src/playground/requests.ts, built to dist/) to the RUNNING
// app, in order, exactly as the page's "Run all in order" does, and prints ✓ or ✗ per request
// with the lab 01 check it reproduces. Exit 0 only when every request answered its expected
// status. It talks to the running app, not to a test copy, so it also catches an app that was
// not rebuilt and restarted after a change: the lab checks and `npm run verify` cannot.
//
// <group> keeps only the groups whose title contains it (e.g. `users`). The URL defaults to
// http://localhost:<PORT from .env, else 3000>. Like the page, it writes to data/app.db;
// `npm run db:seed` puts it back.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'playground', 'requests.js');
if (!existsSync(built)) {
  console.error(
    'playground:check: dist/ is missing: run `npm run build` first.',
  );
  process.exit(1);
}
const { PLAYGROUND } = await import(pathToFileURL(built).href);

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const envPort = existsSync(join(root, '.env'))
  ? /^PORT=(\d+)/m.exec(readFileSync(join(root, '.env'), 'utf8'))?.[1]
  : undefined;
const base =
  urlArg >= 0 ? args[urlArg + 1] : `http://localhost:${envPort ?? 3000}`;
const only = args.find(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--url',
);

const vars = {};
const fill = (text) =>
  text.replace(/{{(upper:)?(\w+)}}/g, (m, up, k) => {
    const v = k === 'now' ? String(Date.now()) : vars[k];
    return v === undefined ? m : up ? v.toUpperCase() : v;
  });
const missing = (text) =>
  [...text.matchAll(/{{(?:upper:)?(\w+)}}/g)]
    .map((m) => m[1])
    .filter((k) => k !== 'now' && !vars[k]);
const pick = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Variables come from earlier groups, so a filtered run still sends the earlier groups first,
// silently, to set them up; only the selected groups are reported.
const groups = PLAYGROUND.map((g) => ({
  ...g,
  report: !only || g.title.toLowerCase().includes(only.toLowerCase()),
}));
if (only && !groups.some((g) => g.report)) {
  console.error(`playground:check: no group title contains "${only}".`);
  process.exit(1);
}
const lastReported = groups.findLastIndex((g) => g.report);

try {
  await fetch(`${base}/api/health`);
} catch {
  console.error(
    `playground:check: nothing answers at ${base}. Start the app (npm run build, then npm start) or pass --url.`,
  );
  process.exit(1);
}

const tally = { ok: 0, bad: 0, skip: 0 };
for (const [gi, g] of groups.entries()) {
  if (gi > lastReported) break;
  if (g.report) console.log(`\n${g.title}`);
  for (const req of g.requests) {
    const raw = req.body ? JSON.stringify(req.body) : '';
    const need = [...new Set([...missing(req.path), ...missing(raw)])];
    let line;
    if (need.length) {
      line = `  - not sent  ${req.name} (needs ${need.join(', ')})`;
      if (g.report) tally.skip++;
    } else {
      const res = await fetch(base + fill(req.path), {
        method: req.method,
        headers: raw ? { 'content-type': 'application/json' } : {},
        body: raw ? fill(raw) : undefined,
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      // Nest's 404 for a route that does not exist ("Cannot GET /…") never counts as a pass,
      // even where a 404 is expected: the route is missing, not the id.
      const noRoute =
        res.status === 404 && /^Cannot [A-Z]+ \//.test(json?.message ?? '');
      const ok = res.status === req.expect && !noRoute;
      if (ok && req.save) {
        for (const [k, path] of Object.entries(req.save)) {
          const v = json && pick(json, path);
          if (v !== undefined) vars[k] = String(v);
        }
      }
      line = `  ${ok ? '✓' : '✗'} ${res.status} ${req.method.padEnd(6)} ${req.name}${ok ? '' : noRoute ? '  (no such route: not built, or the app was not restarted?)' : `  (expected ${req.expect})`}`;
      if (g.report) ok ? tally.ok++ : tally.bad++;
    }
    if (g.report) {
      console.log(line);
      for (const c of [].concat(req.check ?? []))
        console.log(`             lab 01 · ${c}`);
    }
  }
}
console.log(
  `\nplayground:check: ${tally.ok} ✓, ${tally.bad} ✗, ${tally.skip} not sent (${base})`,
);
process.exitCode = tally.bad || tally.skip ? 1 : 0;
