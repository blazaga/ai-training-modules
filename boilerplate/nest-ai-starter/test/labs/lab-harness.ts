import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { attachMcp } from '../../src/bootstrap/attach-mcp.js';
import { configureApp } from '../../src/bootstrap/configure-app.js';

/**
 * Shared set-up for the lab checks. A lab check talks to the app ONLY through
 * HTTP and MCP, never by importing your code, so it compiles before you have
 * written anything and checks the behaviour the lab asks for, not how you built it.
 */

export type Credentials = { accessKeyId: string; secret: string };
export type DeviceState = 'draft' | 'active' | 'archived';
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
  close: () => Promise<void>;
}

/** The whole app, listening on a random port, MCP mounted (as `pnpm start` does). */
export async function startApp(): Promise<LabApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await attachMcp(app);
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    rest: () => supertest(app.getHttpServer()),
    mcpUrl: `http://localhost:${port}/mcp`,
    close: () => app.close(),
  };
}

export const basic = (email: string, password: string) =>
  `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

/** Signs up a user (public route) and returns its id and Authorization header. */
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
  return { id: res.body.id, email, auth: basic(email, password) };
}

/** A device of `auth`'s user, taken through the REST lifecycle to `state`. */
export async function device(
  lab: LabApp,
  auth: string,
  state: DeviceState = 'active',
  credentialsBody?: Record<string, unknown>,
): Promise<Credentials & { id: string }> {
  const created = await lab
    .rest()
    .post('/api/v1/devices')
    .set('Authorization', auth)
    .send({ name: `lab ${state}` });
  if (created.status !== 201)
    throw new Error(`create device answered ${created.status}`);
  const id = created.body.id as string;
  const issued = await lab
    .rest()
    .post(`/api/v1/devices/${id}/credentials`)
    .set('Authorization', auth)
    .send(credentialsBody ?? {});
  if (issued.status !== 200) {
    throw new Error(
      `issue credentials answered ${issued.status}: ${JSON.stringify(issued.body)}`,
    );
  }
  if (state !== 'draft') {
    await lab
      .rest()
      .post(`/api/v1/devices/${id}/activate`)
      .set('Authorization', auth)
      .expect(200);
  }
  if (state === 'archived') {
    await lab
      .rest()
      .post(`/api/v1/devices/${id}/archive`)
      .set('Authorization', auth)
      .expect(200);
  }
  return {
    id,
    accessKeyId: issued.body.accessKeyId,
    secret: issued.body.secret,
  };
}

export const deviceHeaders = (c: Credentials) => ({
  'X-Access-Key-Id': c.accessKeyId,
  'X-Secret-Key': c.secret,
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
