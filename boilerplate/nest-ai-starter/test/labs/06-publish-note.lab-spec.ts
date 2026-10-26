import type { Client } from '@modelcontextprotocol/client';
import {
  callTool,
  device,
  type LabApp,
  mcpClient,
  signUp,
  startApp,
  textOf,
} from './lab-harness.js';

/**
 * Lab 06 (module 4): an MCP tool `publish-note`.
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
  let auth: string;
  let client: Client;
  const missing = '00000000-0000-4000-8000-000000000000';
  const note = async (body: string) => {
    const res = await lab
      .rest()
      .post('/api/v1/notes')
      .set('Authorization', auth)
      .send({ title: 'Lab note', body })
      .expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    lab = await startApp();
    auth = (await signUp(lab, 'lab06@example.com')).auth;
    client = await mcpClient(lab, await device(lab, auth, 'active'));
  });
  afterAll(async () => {
    await client.close();
    await lab.close();
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
    const stored = await lab
      .rest()
      .get(`/api/v1/notes/${id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(stored.body.status).toBe('published');
  });

  it('an empty body is a tool error RULE_VIOLATION, and nothing is stored', async () => {
    const id = await note('');
    const result = await callTool(client, 'publish-note', { id });
    expect(
      result.isError,
      'wrap the body in runTool() so a DomainError becomes a tool error',
    ).toBe(true);
    expect(textOf(result)).toMatch(/^RULE_VIOLATION/);
    const stored = await lab
      .rest()
      .get(`/api/v1/notes/${id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(stored.body.status).toBe('draft');
  });

  it('an unknown id is a tool error NOT_FOUND', async () => {
    const result = await callTool(client, 'publish-note', { id: missing });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^NOT_FOUND/);
  });
});
