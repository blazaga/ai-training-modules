import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module.js';
import { attachMcp } from '../src/bootstrap/attach-mcp.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

/** ch08: the same MCP tools, over Streamable HTTP, on a real listening server. */
describe('MCP over Streamable HTTP (e2e)', () => {
  let app: INestApplication;
  let url: string;

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

  it('a real MCP client lists and calls tools over HTTP (no credentials needed YET: ch09 changes this)', async () => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('create-note');
    const result = (await client.callTool({
      name: 'create-note',
      arguments: { title: 'over HTTP' },
    })) as { content: { text: string }[] };
    expect(JSON.parse(result.content[0].text).title).toBe('over HTTP');
    await client.close();
  });

  it('responses are Server-Sent Events: `event: message` + `data: <JSON-RPC>`', async () => {
    const res = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'raw', version: '1' },
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toMatch(/^event: message\ndata: /);
    const data = JSON.parse(text.split('data: ')[1]);
    expect(data).toMatchObject({
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
    // fetch silently replaces it (measured). The request would arrive as
    // localhost and this test would pass for the wrong reason. node:http sends
    // the header as written.
    const status = (host: string) =>
      new Promise<number | undefined>((resolve, reject) => {
        const { port } = new URL(url);
        const req = request(
          {
            host: 'localhost',
            port,
            path: '/mcp',
            method: 'POST',
            headers: {
              host,
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on('error', reject);
        req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
      });
    // Control: identical request, only the Host differs.
    expect(await status(`localhost:${new URL(url).port}`)).toBe(200);
    expect(await status('evil.example')).toBe(403);
  });
});
