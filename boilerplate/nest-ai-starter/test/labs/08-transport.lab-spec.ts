import {
  device,
  deviceHeaders,
  type LabApp,
  mcpClient,
  rawMcp,
  signUp,
  startApp,
} from './lab-harness.js';

/**
 * Lab 08 (module 5): the same MCP tools over Streamable HTTP at /mcp (specs/mcp.md).
 *
 * Green once module 5 is built. Then the experiment: flip `enableJsonResponse` (and,
 * optionally, `statefulMode`) in src/bootstrap/attach-mcp.ts and compare the wire: this
 * check fails. Revert, rebuild, and it passes again.
 */
describe('Lab 08 · transport settings', () => {
  let lab: LabApp;
  let headers: Record<string, string>;
  const initialize = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'lab-08', version: '1' },
    },
  };

  beforeAll(async () => {
    lab = await startApp();
    const { auth } = await signUp(lab, 'lab08@example.com');
    headers = deviceHeaders(await device(lab, auth, 'active'));
  });
  afterAll(() => lab?.close());

  it('answers as an SSE stream: one `message` event carrying the JSON-RPC reply', async () => {
    const res = await rawMcp(lab, initialize, headers)
      .buffer(true)
      .parse((r, cb) => {
        let text = '';
        r.on('data', (c: Buffer) => (text += c.toString('utf8')));
        r.on('end', () => cb(null, text));
      });
    expect(res.status).toBe(200);
    expect(
      res.headers['content-type'],
      'enableJsonResponse must be false',
    ).toMatch(/^text\/event-stream/);
    const data = String(res.body)
      .split('\n')
      .find((l) => l.startsWith('data: '));
    expect(data, 'an SSE frame has a `data: ` line').toBeDefined();
    const msg = JSON.parse(data!.slice(6));
    expect(msg).toMatchObject({ jsonrpc: '2.0', id: 1 });
    expect(msg.result.serverInfo.name).toBe('nest-ai-starter');
  });

  it('serves the notes tools over HTTP (the same tools as stdio)', async () => {
    const client = await mcpClient(lab, {
      deviceKey: headers['X-Device-Key'],
      secret: headers['X-Device-Secret'],
    });
    try {
      const names = (await client.listTools()).tools.map((t) => t.name);
      expect(names, 'is McpToolsModule imported in AppModule?').toEqual(
        expect.arrayContaining(['create-note', 'get-note', 'list-notes']),
      );
    } finally {
      await client.close();
    }
  });

  it('is stateless: no Mcp-Session-Id header', async () => {
    const res = await rawMcp(lab, initialize, headers);
    expect(
      res.headers['mcp-session-id'],
      'statefulMode must be false',
    ).toBeUndefined();
  });

  it('refuses a Host that is not allowed (403), even with valid credentials', async () => {
    const res = await rawMcp(
      lab,
      { jsonrpc: '2.0', id: 2, method: 'ping' },
      { ...headers, Host: 'evil.example' },
    );
    expect(res.status, 'DNS-rebinding protection: MCP_ALLOWED_HOSTS').toBe(403);
  });
});
