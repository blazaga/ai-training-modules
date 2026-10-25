import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

type TextResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

/**
 * ch06: drive the STDIO server exactly as an MCP client (an IDE, an agent)
 * would: spawn the process, `initialize`, list tools, call them.
 */
describe('MCP over stdio (e2e)', () => {
  let client: Client;
  let stderr = '';

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, '..', 'dist', 'mcp-stdio.js')],
      stderr: 'pipe',
    });
    transport.stderr?.on('data', (chunk: Buffer) => (stderr += String(chunk)));
    client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })) as TextResult;

  it('initialize: identifies the server', () => {
    expect(client.getServerVersion()).toMatchObject({
      name: 'nest-ai-starter',
    });
  });

  it('lists the tools, with input schemas generated from zod', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create-note',
      'get-note',
      'list-notes',
    ]);
    const create = tools.find((t) => t.name === 'create-note');
    expect(create?.inputSchema.required).toEqual(['title']);
  });

  it('create-note then list-notes: tools call the real service', async () => {
    const created = await call('create-note', {
      title: 'From MCP',
      body: 'hi',
    });
    expect(created.isError ?? false).toBe(false);
    expect(JSON.parse(created.content[0].text)).toMatchObject({
      title: 'From MCP',
      status: 'draft',
    });
    const list = await call('list-notes', {});
    expect(JSON.parse(list.content[0].text).total).toBeGreaterThanOrEqual(1);
  });

  it('a DomainError becomes a tool error the model can read (isError)', async () => {
    const missing = await call('get-note', {
      id: '00000000-0000-4000-8000-000000000000',
    });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toMatch(/^NOT_FOUND:/);
  });

  it('invalid input is rejected by the SAME schema as REST (incl. rule R2)', async () => {
    const bad = await call('create-note', { title: 'x', status: 'published' });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(
      /a published note needs a non-empty body/,
    );
  });

  it('stdout carries only protocol: diagnostics went to stderr', () => {
    expect(stderr).toContain('mcp-stdio: ready');
  });

  it('RAW stdout: every line is a JSON-RPC 2.0 message (no stray logging)', async () => {
    // The SDK client silently skips non-JSON lines, so the test above cannot
    // catch a stray console.log. Read the raw stream instead.
    const child = spawn(process.execPath, [
      join(import.meta.dirname, '..', 'dist', 'mcp-stdio.js'),
    ]);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += String(chunk)));
    const send = (message: object) =>
      child.stdin.write(`${JSON.stringify(message)}\n`);
    const linesSoFar = () => out.split('\n').filter((l) => l.trim());
    const waitForLines = async (n: number) => {
      for (let i = 0; i < 100 && linesSoFar().length < n; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'raw', version: '1' },
      },
    });
    await waitForLines(1);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'list-notes', arguments: {} },
    });
    await waitForLines(2);
    child.kill();
    const lines = linesSoFar();
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: '2.0' });
    }
  });
});
