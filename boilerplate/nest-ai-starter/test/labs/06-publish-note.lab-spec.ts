import type { Client } from '@modelcontextprotocol/client';
import {
  callTool,
  device,
  type LabApp,
  mcpClient,
  signUp,
  startApp,
  stdioClient,
  textOf,
} from './lab-harness.js';

/**
 * Lab 06 (module 4): an MCP tool `publish-note`. Checked over stdio, the transport module 4
 * builds; once the app serves /mcp (module 5 on), over HTTP as a device instead, so the
 * check still holds after tools are scoped to a device's owner (the capstone).
 *
 * The contract:
 *   name        publish-note
 *   parameters  { id: uuid }
 *   effect      sets the note's status to `published`, through NotesService (so rule R5 applies:
 *               a published note needs a non-empty body)
 *   errors      come back as TOOL errors (isError: true), text starting with the DomainError code:
 *               RULE_VIOLATION for an empty body, NOT_FOUND for an unknown id
 */
describe('Lab 06 · publish-note tool', () => {
  let lab: LabApp;
  let client: Client;
  const missing = '00000000-0000-4000-8000-000000000000';

  /** A draft note created through the server's own create-note tool. */
  const note = async (body: string) => {
    const created = await callTool(client, 'create-note', {
      title: 'Lab note',
      body,
    });
    expect(created.isError, textOf(created)).not.toBe(true);
    return JSON.parse(textOf(created)).id as string;
  };
  const statusOf = async (id: string) =>
    JSON.parse(textOf(await callTool(client, 'get-note', { id }))).status;

  beforeAll(async () => {
    lab = await startApp();
    if (lab.hasMcpHttp) {
      const { auth } = await signUp(lab, 'lab06@example.com');
      client = await mcpClient(lab, await device(lab, auth, 'active'));
    } else {
      client = await stdioClient();
    }
  });
  afterAll(async () => {
    await client?.close();
    await lab?.close();
  });

  it('tools/list includes publish-note with an `id` parameter', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'publish-note');
    expect(
      tool,
      `tools found: ${tools.map((t) => t.name).join(', ')}`,
    ).toBeDefined();
    expect(
      tool?.description,
      'a description that states the rule helps the model',
    ).toBeTruthy();
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toContain('id');
  });

  it('publishes a draft note that has a body', async () => {
    const id = await note('Ready to share');
    const result = await callTool(client, 'publish-note', { id });
    expect(result.isError, textOf(result)).not.toBe(true);
    expect(await statusOf(id)).toBe('published');
  });

  it('an empty body is a tool error RULE_VIOLATION, and nothing is stored', async () => {
    const id = await note('');
    const result = await callTool(client, 'publish-note', { id });
    expect(
      result.isError,
      'wrap the body in runTool() so a DomainError becomes a tool error',
    ).toBe(true);
    expect(textOf(result)).toMatch(/^RULE_VIOLATION/);
    expect(await statusOf(id)).toBe('draft');
  });

  it('an unknown id is a tool error NOT_FOUND', async () => {
    const result = await callTool(client, 'publish-note', { id: missing });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^NOT_FOUND/);
  });
});
