// Print the Claude Desktop config entry for the module 2 MCP server, with absolute paths for
// THIS machine. `node scripts/claude-desktop-config.mjs` from the project folder.
//
// Why absolute paths: Claude Desktop starts the server itself, from its own working folder and
// with a minimal PATH. A relative `dist/mcp-server.js` or `data/app.db` then points nowhere, and
// a bare `node` may not be found (nvm and similar installs are not on a GUI app's PATH). So the
// command is the absolute path of the node running this script, and the database is an
// absolute file: URL.
//
// Without arguments it only prints: paste the block into Claude Desktop's config file (the path is
// printed too), then quit and reopen Claude Desktop.
//
// With --install it writes the entry into that file itself: it backs the file up first, keeps every
// other server already in it, adds or replaces only "notes-db", and refuses to touch a file it
// cannot parse. CLAUDE_DESKTOP_CONFIG=<path> points it at another file (also used by its test).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = join(root, 'dist', 'mcp-server.js');
const db = join(root, 'data', 'app.db');
// libSQL wants forward slashes in a file: URL, also on Windows (C:/Users/...).
const dbUrl = `file:${db.replaceAll('\\', '/')}`;

const install = process.argv.includes('--install');
const configFile = process.env.CLAUDE_DESKTOP_CONFIG
  ? resolve(process.env.CLAUDE_DESKTOP_CONFIG)
  : process.platform === 'darwin'
    ? join(
        homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json',
      )
    : process.platform === 'win32'
      ? join(
          process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
          'Claude',
          'claude_desktop_config.json',
        )
      : '(Claude Desktop is available for macOS and Windows; on Linux use Claude Code instead)';

const problems = [];
if (!existsSync(server))
  problems.push(
    'dist/mcp-server.js is missing: build the module 2 server first (`npm run build`).',
  );
if (!existsSync(db))
  problems.push('data/app.db is missing: rebuild it with `npm run db:seed`.');

const entry = {
  mcpServers: {
    'notes-db': {
      command: process.execPath,
      args: [server],
      env: { DATABASE_URL: dbUrl },
    },
  },
};

const RESTART =
  'Quit Claude Desktop completely (on Windows, also from the system tray) and reopen it: the notes-db tools then appear in its tools menu.';

if (!install) {
  console.error(`Claude Desktop config file: ${configFile}`);
  console.error(
    'Add the "notes-db" entry below inside its "mcpServers" object (create the file with exactly this if it does not exist), or run this script with --install to do it for you.',
  );
  for (const p of problems) console.error(`WARNING: ${p}`);
  console.log(JSON.stringify(entry, null, 2));
  process.exitCode = problems.length ? 1 : 0;
} else {
  const fail = (message) => {
    console.error(`NOT INSTALLED: ${message}`);
    process.exit(1);
  };
  if (problems.length) fail(problems.join(' '));
  if (!configFile.endsWith('.json'))
    fail(
      `${configFile}. Set CLAUDE_DESKTOP_CONFIG to the config file's path to install anyway.`,
    );
  let config = {};
  if (existsSync(configFile)) {
    const raw = readFileSync(configFile, 'utf8');
    try {
      config = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      fail(
        `${configFile} is not valid JSON, so it was left as it is. Fix it (Claude Desktop → Settings → Developer → Edit Config) and run this again.`,
      );
    }
    if (typeof config !== 'object' || config === null || Array.isArray(config))
      fail(
        `${configFile} does not hold a JSON object, so it was left as it is.`,
      );
    const backup = `${configFile}.bak-${Date.now()}`;
    copyFileSync(configFile, backup);
    console.error(`backup: ${backup}`);
  } else {
    mkdirSync(dirname(configFile), { recursive: true });
  }
  const others = Object.keys(config.mcpServers ?? {}).filter(
    (name) => name !== 'notes-db',
  );
  config.mcpServers = { ...config.mcpServers, ...entry.mcpServers };
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  console.error(
    `installed "notes-db" in ${configFile}` +
      (others.length ? ` (kept: ${others.join(', ')})` : ''),
  );
  console.error(RESTART);
}
