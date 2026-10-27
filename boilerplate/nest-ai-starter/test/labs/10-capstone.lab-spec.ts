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
 * Lab 10 (capstone; module 6 homework): device-scoped notes.
 *
 * The contract:
 *   - every note has an owner: the signed-in user over REST, the device's owner over MCP
 *   - REST: another user's note is 404 for GET, PATCH and DELETE, and absent from the list
 *   - MCP: a new tool `my-notes` lists only the caller's notes ({ items, total });
 *          get-note on another user's note is a tool error NOT_FOUND
 */
describe('Lab 10 · capstone: device-scoped notes', () => {
  let lab: LabApp;
  let ada: { auth: string };
  let bob: { auth: string };
  let adaClient: Client;
  let bobClient: Client;
  const notes = '/api/v1/notes';
  const restNote = async (who: { auth: string }, title: string) => {
    const res = await lab
      .rest()
      .post(notes)
      .set('Authorization', who.auth)
      .send({ title, body: 'lab 10' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.id as string;
  };
  const idsIn = (text: string) =>
    [
      ...text.matchAll(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      ),
    ].map((m) => m[0]);

  beforeAll(async () => {
    lab = await startApp();
    ada = await signUp(lab, 'lab10-ada@example.com');
    bob = await signUp(lab, 'lab10-bob@example.com');
    adaClient = await mcpClient(lab, await device(lab, ada.auth, 'active'));
    bobClient = await mcpClient(lab, await device(lab, bob.auth, 'active'));
  });
  afterAll(async () => {
    await adaClient?.close();
    await bobClient?.close();
    await lab?.close();
  });

  it("REST: another user's note is 404 for GET, PATCH and DELETE", async () => {
    const id = await restNote(ada, "Ada's REST note");
    await lab
      .rest()
      .get(`${notes}/${id}`)
      .set('Authorization', ada.auth)
      .expect(200);
    const res = await lab
      .rest()
      .get(`${notes}/${id}`)
      .set('Authorization', bob.auth);
    expect(
      res.status,
      '404, never 403: ids must not be probeable (chapter 04)',
    ).toBe(404);
    await lab
      .rest()
      .patch(`${notes}/${id}`)
      .set('Authorization', bob.auth)
      .send({ title: 'mine now' })
      .expect(404);
    await lab
      .rest()
      .delete(`${notes}/${id}`)
      .set('Authorization', bob.auth)
      .expect(404);
    await lab
      .rest()
      .get(`${notes}/${id}`)
      .set('Authorization', ada.auth)
      .expect(200);
  });

  it("REST: the list shows only the caller's notes", async () => {
    const adas = await restNote(ada, 'Ada list note');
    const bobs = await restNote(bob, 'Bob list note');
    const list = await lab
      .rest()
      .get(`${notes}?limit=100`)
      .set('Authorization', bob.auth)
      .expect(200);
    const ids = list.body.items.map((n: { id: string }) => n.id);
    expect(ids).toContain(bobs);
    expect(ids).not.toContain(adas);
  });

  it("MCP: my-notes lists only the calling device's owner's notes", async () => {
    const adas = await restNote(ada, 'Ada MCP note');
    const bobs = await restNote(bob, 'Bob MCP note');
    const { tools } = await adaClient.listTools();
    expect(
      tools.map((t) => t.name),
      'add the my-notes tool',
    ).toContain('my-notes');
    const result = await callTool(adaClient, 'my-notes');
    expect(result.isError, textOf(result)).not.toBe(true);
    const ids = idsIn(textOf(result));
    expect(ids).toContain(adas);
    expect(ids).not.toContain(bobs);
  });

  it('MCP: create-note gives the note to the device owner', async () => {
    const result = await callTool(adaClient, 'create-note', {
      title: 'Made over MCP',
      body: 'by a device',
    });
    expect(result.isError, textOf(result)).not.toBe(true);
    const id = JSON.parse(textOf(result)).id as string;
    await lab
      .rest()
      .get(`${notes}/${id}`)
      .set('Authorization', ada.auth)
      .expect(200);
    await lab
      .rest()
      .get(`${notes}/${id}`)
      .set('Authorization', bob.auth)
      .expect(404);
  });

  it("MCP: get-note on another user's note is a tool error NOT_FOUND", async () => {
    const id = await restNote(ada, 'Ada private note');
    const result = await callTool(bobClient, 'get-note', { id });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^NOT_FOUND/);
  });
});
