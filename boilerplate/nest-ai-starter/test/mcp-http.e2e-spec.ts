import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { attachMcp } from '../src/bootstrap/attach-mcp.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

type Credentials = { accessKeyId: string; secret: string };
type TextResult = { content: { text: string }[]; isError?: boolean };

/**
 * ch08 + ch09: the MCP tools over Streamable HTTP on a real listening server,
 * authenticated with a device's access key id + secret (from ch04).
 */
describe('MCP over Streamable HTTP (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let owner: { id: string; email: string };
  const ownerPassword = 'mcp owner passphrase';
  const basic = (email: string, password: string) =>
    `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;
  const rest = () => supertest(app.getHttpServer());

  /** A device taken through the REST lifecycle to the state asked for. */
  async function device(
    state: 'draft' | 'active' | 'archived',
  ): Promise<Credentials & { id: string }> {
    const auth = basic(owner.email, ownerPassword);
    const { body } = await rest()
      .post('/api/v1/devices')
      .set('Authorization', auth)
      .send({ name: `agent-${state}` })
      .expect(201);
    const issued = await rest()
      .post(`/api/v1/devices/${body.id}/credentials`)
      .set('Authorization', auth)
      .expect(200);
    if (state !== 'draft') {
      await rest()
        .post(`/api/v1/devices/${body.id}/activate`)
        .set('Authorization', auth)
        .expect(200);
    }
    if (state === 'archived') {
      await rest()
        .post(`/api/v1/devices/${body.id}/archive`)
        .set('Authorization', auth)
        .expect(200);
    }
    return {
      id: body.id,
      accessKeyId: issued.body.accessKeyId,
      secret: issued.body.secret,
    };
  }
  const headersFor = (c: Credentials) => ({
    'X-Access-Key-Id': c.accessKeyId,
    'X-Secret-Key': c.secret,
  });

  let active: Credentials & { id: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await attachMcp(app);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://localhost:${port}/mcp`;
    const signup = await rest()
      .post('/api/v1/users')
      .send({
        email: 'mcp-owner@example.com',
        name: 'MCP Owner',
        password: ownerPassword,
      })
      .expect(201);
    owner = signup.body;
    active = await device('active');
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: object, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };

  async function connect(credentials: Credentials): Promise<Client> {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: headersFor(credentials) },
      }),
    );
    return client;
  }

  describe('ch09: device authentication', () => {
    it('an ACTIVE device: a real MCP client lists and calls tools', async () => {
      const client = await connect(active);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(
        expect.arrayContaining(['create-note', 'whoami']),
      );
      const result = (await client.callTool({
        name: 'create-note',
        arguments: { title: 'over HTTP' },
      })) as TextResult;
      expect(JSON.parse(result.content[0].text).title).toBe('over HTTP');
      await client.close();
    });

    it('whoami: the tool sees WHICH device called, and its owner', async () => {
      const client = await connect(active);
      const result = (await client.callTool({
        name: 'whoami',
        arguments: {},
      })) as TextResult;
      const me = JSON.parse(result.content[0].text);
      expect(me.device).toMatchObject({
        id: active.id,
        accessKeyId: active.accessKeyId,
        ownerUserId: owner.id,
      });
      expect(me.owner).toMatchObject({ id: owner.id, email: owner.email });
      expect(JSON.stringify(me)).not.toMatch(/secretHash|passwordHash/);
      await client.close();
    });

    it('every failure is the SAME HTTP 401, before any JSON-RPC', async () => {
      const draft = await device('draft');
      const archived = await device('archived');
      const rotated = await device('active');
      // Rotate: the secret captured above must stop working immediately.
      await rest()
        .post(`/api/v1/devices/${rotated.id}/credentials`)
        .set('Authorization', basic(owner.email, ownerPassword))
        .expect(200);
      const attempts: [string, Record<string, string>][] = [
        ['no headers', {}],
        ['key id only', { 'X-Access-Key-Id': active.accessKeyId }],
        [
          'unknown key id',
          headersFor({ ...active, accessKeyId: 'AKIDAAAAAAAAAAAAAAAA' }),
        ],
        ['wrong secret', headersFor({ ...active, secret: 'dsk_wrong' })],
        ['draft device', headersFor(draft)],
        ['archived device', headersFor(archived)],
        ['rotated-away secret', headersFor(rotated)],
      ];
      const bodies = new Set<string>();
      for (const [label, headers] of attempts) {
        const res = await post(ping, headers);
        expect({ label, status: res.status }).toEqual({ label, status: 401 });
        bodies.add(await res.text());
      }
      expect(bodies.size).toBe(1);
    });
  });

  it('responses are Server-Sent Events: `event: message` + `data: <JSON-RPC>`', async () => {
    const res = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw', version: '1' },
        },
      },
      headersFor(active),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toMatch(/^event: message\ndata: /);
    expect(JSON.parse(text.split('data: ')[1])).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { serverInfo: { name: 'nest-ai-starter' } },
    });
  });

  it('is mounted at /mcp, OUTSIDE the /api prefix', async () => {
    const res = await fetch(url.replace('/mcp', '/api/mcp'), {
      method: 'POST',
    });
    expect(res.status).toBe(404);
  });

  it('rejects a foreign Host header (DNS-rebinding protection): 403', async () => {
    // NOT fetch: under the Fetch spec `Host` is a forbidden header, and Node's
    // fetch silently replaces it (measured). node:http sends it as written.
    // Valid device credentials on both, so the Host is the ONLY difference.
    const status = (host: string) =>
      new Promise<number | undefined>((resolve, reject) => {
        const req = request(
          {
            host: 'localhost',
            port: new URL(url).port,
            path: '/mcp',
            method: 'POST',
            headers: {
              host,
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              ...headersFor(active),
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on('error', reject);
        req.end(JSON.stringify(ping));
      });
    expect(await status(`localhost:${new URL(url).port}`)).toBe(200);
    expect(await status('evil.example')).toBe(403);
  });
});
