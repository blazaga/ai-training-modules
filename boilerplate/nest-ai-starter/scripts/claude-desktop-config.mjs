// Print the Claude Desktop config entry for the module 2 MCP server, with absolute paths for
// THIS machine. `node scripts/claude-desktop-config.mjs` from the project folder.
//
// Why absolute paths: Claude Desktop starts the server itself, from its own working folder and
// with a minimal PATH. A relative `dist/mcp-server.js` or `data/app.db` then points nowhere, and
// a bare `node` may not be found (nvm and similar installs are not on a GUI app's PATH). So the
// command is the absolute path of the node running this script, and the database is an
// absolute file: URL.
//
// It only prints. Paste the block into Claude Desktop's config file (the path is printed too),
// then quit and reopen Claude Desktop.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = join(root, 'dist', 'mcp-server.js');
const db = join(root, 'data', 'app.db');
// libSQL wants forward slashes in a file: URL, also on Windows (C:/Users/...).
const dbUrl = `file:${db.replaceAll('\\', '/')}`;

const configFile =
  process.platform === 'darwin'
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
    'dist/mcp-server.js is missing: build the module 2 server first (`pnpm build`).',
  );
if (!existsSync(db))
  problems.push('data/app.db is missing: rebuild it with `pnpm db:seed`.');

const entry = {
  mcpServers: {
    'notes-db': {
      command: process.execPath,
      args: [server],
      env: { DATABASE_URL: dbUrl },
    },
  },
};

console.error(`Claude Desktop config file: ${configFile}`);
console.error(
  'Add the "notes-db" entry below inside its "mcpServers" object (create the file with exactly this if it does not exist), then quit and reopen Claude Desktop.',
);
for (const p of problems) console.error(`WARNING: ${p}`);
console.log(JSON.stringify(entry, null, 2));
process.exitCode = problems.length ? 1 : 0;
