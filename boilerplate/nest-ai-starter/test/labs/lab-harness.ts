import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';

/**
 * Shared set-up for the lab checks. A lab check talks to the app ONLY through
 * HTTP and MCP, never by importing your code, so it compiles before you have
 * written anything and checks the behaviour the lab asks for, not how you built it.
 */

export type Credentials = { deviceKey: string; secret: string };
export type DeviceState = 'active' | 'archived';
export type ToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

export interface LabApp {
  app: INestApplication;
  /** supertest against the running app. */
  rest: () => ReturnType<typeof supertest>;
  /** http://localhost:<port>/mcp */
  mcpUrl: string;
  /** True once the app serves MCP over HTTP (module 5 on). */
  hasMcpHttp: boolean;
  close: () => Promise<void>;
}

/**
 * src/bootstrap/attach-mcp.ts, if the app has it yet. Loaded by a computed path, so the
 * lab checks compile at every module, before that file exists.
 */
async function loadAttachMcp(): Promise<
  ((app: INestApplication) => Promise<void>) | undefined
> {
  const path = '../../src/bootstrap/attach-mcp.js';
  try {
    const mod = (await import(/* @vite-ignore */ path)) as {
      attachMcp: (app: INestApplication) => Promise<void>;
    };
    return mod.attachMcp;
  } catch (error) {
    // Only "not there yet" means no MCP; any other error (say, a typo in the file) is real.
    if ((error as { code?: string }).code === 'ERR_MODULE_NOT_FOUND')
      return undefined;
    if (/Cannot find module|Failed to load url/i.test(String(error)))
      return undefined;
    throw error;
  }
}

/** The whole app, listening on a random port, MCP mounted when it exists (as `pnpm start` does). */
export async function startApp(): Promise<LabApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  // The MCP transport exists from module 5 on; before that the app has no /mcp.
  const attachMcp = await loadAttachMcp();
  if (attachMcp) await attachMcp(app);
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    rest: () => supertest(app.getHttpServer()),
    mcpUrl: `http://localhost:${port}/mcp`,
    hasMcpHttp: attachMcp !== undefined,
    close: () => app.close(),
  };
}

export const basic = (email: string, password: string) =>
  `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

/**
 * Logs in with Basic and returns the Authorization header for later requests:
 * `Bearer <token>`. Before module 3 the app has no login route (404): then there is
 * nothing to send, and the header is empty.
 */
export async function login(
  lab: LabApp,
  email: string,
  password: string,
): Promise<string> {
  const res = await lab
    .rest()
    .post('/api/v1/auth/login')
    .set('Authorization', basic(email, password));
  if (res.status === 404) return '';
  if (res.status !== 200) {
    throw new Error(`login of ${email} answered ${res.status}`);
  }
  return `Bearer ${res.body.accessToken}`;
}

/** True once the app has authentication (module 3 on): a login route exists. */
export async function hasAuth(lab: LabApp): Promise<boolean> {
  const res = await lab.rest().post('/api/v1/auth/login');
  return res.status !== 404;
}

/**
 * Signs up a user (public route), logs in with Basic, and returns its id and the
 * Authorization header every later request sends: `Bearer <token>`.
 */
export async function signUp(
  lab: LabApp,
  email: string,
  password = 'lab passphrase 123',
): Promise<{ id: string; email: string; auth: string }> {
  const res = await lab
    .rest()
    .post('/api/v1/users')
    .send({ email, name: 'Lab User', password });
  if (res.status !== 201) {
    throw new Error(
      `sign-up of ${email} answered ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return { id: res.body.id, email, auth: await login(lab, email, password) };
}

/** A device of `auth`'s user: provisioned (with `extra` in the body), then archived if asked. */
export async function device(
  lab: LabApp,
  auth: string,
  state: DeviceState = 'active',
  extra?: Record<string, unknown>,
): Promise<Credentials & { id: string }> {
  const provisioned = await lab
    .rest()
    .post('/api/v1/devices/provision')
    .set('Authorization', auth)
    .send({ name: `lab ${state}`, ...extra });
  if (provisioned.status !== 201) {
    throw new Error(
      `provision answered ${provisioned.status}: ${JSON.stringify(provisioned.body)}`,
    );
  }
  const id = provisioned.body.id as string;
  if (state === 'archived') {
    await lab
      .rest()
      .delete(`/api/v1/devices/${id}`)
      .set('Authorization', auth)
      .expect(204);
  }
  return {
    id,
    deviceKey: provisioned.body.deviceKey,
    secret: provisioned.body.secret,
  };
}

export const deviceHeaders = (c: Credentials) => ({
  'X-Device-Key': c.deviceKey,
  'X-Device-Secret': c.secret,
});

/** An MCP client connected over Streamable HTTP with a device's headers. Close it after use. */
export async function mcpClient(lab: LabApp, c: Credentials): Promise<Client> {
  const client = new Client({ name: 'lab-check', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(lab.mcpUrl), {
      requestInit: { headers: deviceHeaders(c) },
    }),
  );
  return client;
}

/**
 * An MCP client on the stdio server (module 4): builds the app, then starts
 * `dist/mcp-stdio.js` as a client would. Close it after use.
 */
export async function stdioClient(): Promise<Client> {
  const root = join(import.meta.dirname, '..', '..');
  execFileSync(join(root, 'node_modules', '.bin', 'nest'), ['build'], {
    cwd: root,
    stdio: 'ignore',
  });
  const entry = join(root, 'dist', 'mcp-stdio.js');
  if (!existsSync(entry)) {
    throw new Error(
      'dist/mcp-stdio.js is missing after `nest build`: is there a src/mcp-stdio.ts entrypoint?',
    );
  }
  const client = new Client({ name: 'lab-check', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [entry] }),
  );
  return client;
}

/** Calls a tool and returns its result (tool errors included: check `isError`). */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

export const textOf = (r: ToolResult) =>
  r.content.map((c) => c.text).join('\n');

/** A raw JSON-RPC POST to /mcp, for checks about the transport itself. */
export function rawMcp(
  lab: LabApp,
  body: unknown,
  headers: Record<string, string>,
) {
  return lab
    .rest()
    .post('/mcp')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .set(headers)
    .send(JSON.stringify(body));
}
