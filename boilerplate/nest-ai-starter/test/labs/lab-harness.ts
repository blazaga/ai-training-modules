import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createClient, type Client as SqlClient } from '@libsql/client';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';

/**
 * Shared by the lab checks. A check drives the app the way a client would (HTTP for lab 01,
 * MCP over stdio for lab 02) and never imports your code, so it compiles before the lab is
 * done and tells you whether the lab BEHAVES as asked, not how you built it.
 */

const root = join(import.meta.dirname, '..', '..');

export type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string }[];
};

export interface LabApp {
  app: INestApplication;
  rest: () => ReturnType<typeof supertest>;
  close: () => Promise<void>;
}

/** The app on an EMPTY in-memory database (tests never read .env), on a free port. */
export async function startApp(): Promise<LabApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  return {
    app,
    rest: () => supertest(app.getHttpServer()),
    close: () => app.close(),
  };
}

export interface LabMcp {
  client: Client;
  /** A direct connection to the server's database copy, to check what a tool really did. */
  db: SqlClient;
  close: () => Promise<void>;
}

/**
 * Builds the project, copies the seeded data/app.db to a temporary file, and starts
 * dist/mcp-server.js over stdio on that copy. The committed database is never touched.
 */
export async function startMcpServer(): Promise<LabMcp> {
  // Run the CLI's JS entry with this node, not node_modules/.bin/<tool>: on Windows that
  // shim is a .cmd file, which execFile cannot start (the sh version is no use there either).
  const nest = join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  execFileSync(process.execPath, [nest, 'build'], {
    cwd: root,
    stdio: 'ignore',
  });
  const entry = join(root, 'dist', 'mcp-server.js');
  if (!existsSync(entry)) {
    throw new Error(
      'dist/mcp-server.js is missing after `nest build`: is there a src/mcp-server.ts entrypoint?',
    );
  }
  const seeded = join(root, 'data', 'app.db');
  if (!existsSync(seeded)) {
    throw new Error('data/app.db is missing: run `pnpm db:seed` to rebuild it');
  }
  const dir = mkdtempSync(join(tmpdir(), 'lab-mcp-'));
  const file = join(dir, 'app.db');
  copyFileSync(seeded, file);
  const client = new Client({ name: 'lab-check', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: { ...process.env, DATABASE_URL: `file:${file}` } as Record<
        string,
        string
      >,
    }),
  );
  const db = createClient({ url: `file:${file}` });
  return {
    client,
    db,
    close: async () => {
      await client.close();
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

export const textOf = (r: ToolResult) =>
  r.content.map((c) => c.text ?? '').join('');

/** The JSON a successful tool returned (fails with the tool's own text if it was an error). */
export function jsonOf<T = unknown>(r: ToolResult): T {
  if (r.isError) throw new Error(`tool error: ${textOf(r)}`);
  return JSON.parse(textOf(r)) as T;
}

/** One value from the database copy, e.g. `scalar(db, 'select count(*) from notes')`. */
export async function scalar(
  db: SqlClient,
  sql: string,
  args: (string | number | null)[] = [],
): Promise<unknown> {
  const rs = await db.execute({ sql, args });
  return rs.rows[0]?.[0];
}
