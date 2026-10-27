import type { PlaygroundGroup } from './requests.js';

/**
 * One self-contained HTML page (no build step, no dependencies): the requests of
 * `requests.ts`, each with a Send button that calls the app from the browser and shows the
 * status (✓ when it is the expected one), the time and the response body.
 */
export function renderPlayground(groups: PlaygroundGroup[]): string {
  // `<` escaped so nothing in the data can close the <script> element.
  const data = JSON.stringify(groups).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>nest-ai-starter · playground</title>
<style>
  :root { --ink:#1b1f24; --muted:#64748b; --mint:#1fb68a; --red:#e5484d; --line:#e2e8f0; --bg:#f8fafc; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
  header { background: var(--ink); color: #fff; padding: 18px 28px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  header h1 { font-size: 20px; margin: 0; flex: 1; }
  header p { margin: 0; color: #cbd5e1; font-size: 13px; width: 100%; }
  main { max-width: 1100px; margin: 0 auto; padding: 20px 28px 60px; }
  button { font: inherit; border: 0; border-radius: 6px; padding: 6px 14px; cursor: pointer; background: var(--mint); color: #fff; font-weight: 600; }
  button.secondary { background: #334155; }
  button:disabled { background: #94a3b8; cursor: not-allowed; }
  .vars { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
  .vars label { font-size: 13px; color: var(--muted); display: flex; gap: 6px; align-items: center; }
  .vars input { font: 12px ui-monospace, Consolas, monospace; width: 290px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; }
  h2 { font-size: 17px; margin: 26px 0 4px; }
  .intro { color: var(--muted); margin: 0 0 10px; font-size: 13px; }
  .req { background: #fff; border: 1px solid var(--line); border-radius: 8px; margin: 8px 0; padding: 10px 14px; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .method { font: 700 12px ui-monospace, Consolas, monospace; padding: 2px 8px; border-radius: 4px; color: #fff; background: #475569; min-width: 62px; text-align: center; }
  .GET { background: #0e7490; } .POST { background: #15803d; } .PATCH { background: #a16207; } .PUT { background: #7e22ce; } .DELETE { background: #b91c1c; }
  .name { font-weight: 600; }
  .path { font: 13px ui-monospace, Consolas, monospace; color: var(--muted); word-break: break-all; }
  .expect { margin-left: auto; font-size: 12px; color: var(--muted); }
  .note { font-size: 12px; color: var(--muted); margin: 4px 0 0; }
  .check { font: 11px ui-monospace, Consolas, monospace; color: #0e7490; margin: 4px 0 0; }
  textarea { width: 100%; font: 12px ui-monospace, Consolas, monospace; margin-top: 8px; border: 1px solid var(--line); border-radius: 4px; padding: 6px; }
  .result { margin-top: 8px; display: none; }
  .status { font-weight: 700; }
  .ok { color: var(--mint); } .bad { color: var(--red); }
  pre { background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 6px; overflow: auto; max-height: 280px; font-size: 12px; margin: 6px 0 0; }
</style>
</head>
<body>
<header>
  <h1>nest-ai-starter · playground</h1>
  <button id="run-all">Run all in order</button>
  <button class="secondary" id="clear">Clear results</button>
  <p>Each button sends a real request to this app and shows what the controller answered. A ✓ means the status is the one the specs expect. Every request names the lab 01 check it reproduces; <code>npm run playground:check</code> sends the same requests from a terminal. On the base, the users and notes routes answer 404 until module 1 is built.</p>
</header>
<main>
  <div class="vars" id="vars"></div>
  <div id="groups"></div>
</main>
<script>
const GROUPS = ${data};
const vars = { userId: '', userEmail: '', friendId: '', noteId: '', spareId: '' };
const $ = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };

// {{name}} is a variable, {{upper:name}} the same in capitals, {{now}} a fresh timestamp.
function fill(text) {
  return text.replace(/{{(upper:)?(\\w+)}}/g, (m, up, k) => {
    const v = k === 'now' ? String(Date.now()) : vars[k];
    return v === undefined ? m : up ? v.toUpperCase() : v;
  });
}
function missing(text) {
  return [...text.matchAll(/{{(?:upper:)?(\\w+)}}/g)].map((m) => m[1]).filter((k) => k !== 'now' && !vars[k]);
}
function pick(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function renderVars() {
  const box = document.getElementById('vars');
  box.textContent = '';
  box.append($('strong', '', 'Variables'));
  for (const k of Object.keys(vars)) {
    const label = $('label', '', k);
    const input = $('input');
    input.value = vars[k];
    input.dataset.var = k;
    input.addEventListener('input', () => { vars[k] = input.value.trim(); });
    label.append(input);
    box.append(label);
  }
}

async function send(req, card) {
  const result = card.querySelector('.result');
  result.style.display = 'block';
  result.textContent = '';
  const raw = req.method === 'GET' || req.method === 'DELETE' ? '' : card.querySelector('textarea')?.value ?? '';
  const need = [...new Set([...missing(req.path), ...missing(raw)])];
  if (need.length) {
    result.append($('span', 'status bad', 'Not sent: set ' + need.join(', ') + ' first (run the request that stores it).'));
    card.dataset.status = 'skip';
    return false;
  }
  const url = fill(req.path);
  const started = performance.now();
  let res, text;
  try {
    res = await fetch(url, { method: req.method, headers: raw ? { 'content-type': 'application/json' } : {}, body: raw ? fill(raw) : undefined });
    text = await res.text();
  } catch (e) {
    result.append($('span', 'status bad', 'No answer: ' + e.message + ' (is the app running?)'));
    card.dataset.status = 'bad';
    return false;
  }
  const ms = Math.round(performance.now() - started);
  let body = text;
  let json;
  try { json = JSON.parse(text); body = JSON.stringify(json, null, 2); } catch { /* not JSON */ }
  // Nest answers a route that does not exist with 404 "Cannot GET /…". That is never a pass,
  // even where the request expects a 404 (a missing route is not "this id does not exist").
  const noRoute = res.status === 404 && /^Cannot [A-Z]+ \\//.test(json?.message ?? '');
  const ok = res.status === req.expect && !noRoute;
  result.append($('span', 'status ' + (ok ? 'ok' : 'bad'), (ok ? '✓ ' : '✗ ') + res.status + ' ' + res.statusText + (noRoute ? ' (no such route: not built yet?)' : '')), $('span', 'path', '  ' + req.method + ' ' + url + ' · ' + ms + ' ms'));
  if (body) result.append($('pre', '', body));
  if (ok && json && req.save) {
    for (const [k, path] of Object.entries(req.save)) {
      const v = pick(json, path);
      if (v !== undefined) vars[k] = String(v);
    }
    renderVars();
  }
  card.dataset.status = ok ? 'ok' : 'bad';
  return ok;
}

function render() {
  const root = document.getElementById('groups');
  for (const g of GROUPS) {
    root.append($('h2', '', g.title), $('p', 'intro', g.intro));
    for (const req of g.requests) {
      const card = $('div', 'req');
      card.dataset.name = req.name;
      const row = $('div', 'row');
      const btn = $('button', '', 'Send');
      row.append($('span', 'method ' + req.method, req.method), $('span', 'name', req.name), $('span', 'path', req.path), $('span', 'expect', 'expect ' + req.expect), btn);
      card.append(row);
      if (req.note) card.append($('p', 'note', req.note));
      for (const c of [].concat(req.check ?? [])) card.append($('p', 'check', 'lab 01 · ' + c));
      if (req.body) {
        const ta = $('textarea');
        ta.rows = Math.min(6, JSON.stringify(req.body, null, 2).split('\\n').length);
        ta.value = JSON.stringify(req.body, null, 2);
        card.append(ta);
      }
      card.append($('div', 'result'));
      btn.addEventListener('click', () => send(req, card));
      card.send = () => send(req, card);
      root.append(card);
    }
  }
}

document.getElementById('run-all').addEventListener('click', async () => {
  for (const card of document.querySelectorAll('.req')) await card.send();
});
document.getElementById('clear').addEventListener('click', () => {
  for (const r of document.querySelectorAll('.result')) { r.textContent = ''; r.style.display = 'none'; }
  for (const c of document.querySelectorAll('.req')) delete c.dataset.status;
});
renderVars();
render();
</script>
</body>
</html>
`;
}
