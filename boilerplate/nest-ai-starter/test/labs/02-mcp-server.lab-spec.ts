import {
  callTool,
  jsonOf,
  type LabMcp,
  scalar,
  startMcpServer,
  textOf,
} from './lab-harness.js';

/**
 * Lab 02 (module 2): an MCP server on the SQLite database (specs/mcp.md), over stdio, against
 * a COPY of the seeded data/app.db. Expected values are read from that copy directly, so the
 * check does not depend on the seed's exact numbers.
 */
describe('Lab 02 · MCP server on the database', () => {
  let mcp: LabMcp;
  const TOOLS = [
    'create-note',
    'describe-table',
    'list-tables',
    'notes-for-user',
    'query',
    'share-note',
    'unshare-note',
    'update-note',
  ];

  beforeAll(async () => {
    mcp = await startMcpServer();
  });
  afterAll(() => mcp?.close());

  const call = (name: string, args: Record<string, unknown> = {}) =>
    callTool(mcp.client, name, args);
  const count = async (table: string) =>
    Number(await scalar(mcp.db, `select count(*) from ${table}`));
  /** A seeded user who owns at least one open note, and that user's id. */
  const ownerOfOpenNote = async () =>
    String(
      await scalar(
        mcp.db,
        "select owner_id from notes where status = 'open' order by id limit 1",
      ),
    );

  it('identifies as notes-db and lists exactly the eight tools', async () => {
    expect(mcp.client.getServerVersion()?.name).toBe('notes-db');
    const { tools } = await mcp.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
  });

  it('list-tables reports the three tables with their real row counts', async () => {
    const rows = jsonOf<{ table: string; rows: number }[]>(
      await call('list-tables'),
    );
    const byName = Object.fromEntries(rows.map((r) => [r.table, r.rows]));
    expect(byName).toEqual({
      users: await count('users'),
      notes: await count('notes'),
      note_shares: await count('note_shares'),
    });
  });

  it('describe-table shows the notes columns', async () => {
    const cols = jsonOf<{ name: string }[]>(
      await call('describe-table', { table: 'notes' }),
    );
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'owner_id', 'title', 'status', 'due_at']),
    );
  });

  it('query runs a SELECT and honours the limit', async () => {
    const res = jsonOf<{ rows: unknown[]; rowCount: number }>(
      await call('query', { sql: 'select id, title from notes', limit: 5 }),
    );
    expect(res.rows).toHaveLength(5);
  });

  it('query refuses a write with READ_ONLY, and the data is unchanged', async () => {
    const before = await count('notes');
    for (const sql of [
      'delete from notes',
      'update notes set title = 1',
      'drop table note_shares',
      'select 1; delete from notes',
    ]) {
      const r = await call('query', { sql });
      expect(r.isError, `"${sql}" must be refused`).toBe(true);
      expect(textOf(r)).toMatch(/^READ_ONLY: /);
    }
    expect(await count('notes')).toBe(before);
    expect(await count('note_shares')).toBeGreaterThan(0);
  });

  it('notes-for-user returns owned and shared notes, marked by access', async () => {
    const userId = String(
      await scalar(
        mcp.db,
        'select user_id from note_shares order by note_id limit 1',
      ),
    );
    const owned = await count(`notes where owner_id = '${userId}'`);
    const shared = await count(`note_shares where user_id = '${userId}'`);
    const all = jsonOf<{ access: string }[]>(
      await call('notes-for-user', { userId }),
    );
    expect(all.filter((x) => x.access === 'owner')).toHaveLength(owned);
    expect(all.filter((x) => x.access === 'shared')).toHaveLength(shared);
    const onlyShared = jsonOf<unknown[]>(
      await call('notes-for-user', { userId, include: 'shared' }),
    );
    expect(onlyShared).toHaveLength(shared);
  });

  it('create-note writes a row; an unknown owner is RULE_VIOLATION', async () => {
    const ownerId = await ownerOfOpenNote();
    const created = jsonOf<{ id: string; status: string }>(
      await call('create-note', {
        ownerId,
        title: 'Written by the lab',
        dueAt: '2026-11-01T09:00:00+08:00',
      }),
    );
    expect(created.status).toBe('open');
    expect(
      await scalar(mcp.db, 'select due_at from notes where id = ?', [
        created.id,
      ]),
    ).toBe('2026-11-01T01:00:00.000Z');
    const bad = await call('create-note', {
      ownerId: '00000000-0000-4000-8000-000000000000',
      title: 'x',
    });
    expect(bad.isError).toBe(true);
    expect(textOf(bad)).toMatch(/^RULE_VIOLATION: /);
  });

  it('update-note: a done note can only be reopened (RULE_VIOLATION otherwise)', async () => {
    const id = String(
      await scalar(
        mcp.db,
        "select id from notes where status = 'done' limit 1",
      ),
    );
    const refused = await call('update-note', { id, title: 'Changed' });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toMatch(/^RULE_VIOLATION: /);
    jsonOf(await call('update-note', { id, status: 'open' }));
    expect(
      await scalar(mcp.db, 'select status from notes where id = ?', [id]),
    ).toBe('open');
    const missing = await call('update-note', {
      id: '00000000-0000-4000-8000-000000000000',
      title: 'x',
    });
    expect(textOf(missing)).toMatch(/^NOT_FOUND: /);
  });

  it('share-note and unshare-note write note_shares; the owner is RULE_VIOLATION', async () => {
    const ownerId = await ownerOfOpenNote();
    const noteId = String(
      await scalar(mcp.db, 'select id from notes where owner_id = ? limit 1', [
        ownerId,
      ]),
    );
    const friend = String(
      await scalar(
        mcp.db,
        'select id from users where id != ? and id not in (select user_id from note_shares where note_id = ?) limit 1',
        [ownerId, noteId],
      ),
    );
    const isShared = async () =>
      Number(
        await scalar(
          mcp.db,
          'select count(*) from note_shares where note_id = ? and user_id = ?',
          [noteId, friend],
        ),
      );
    jsonOf(await call('share-note', { noteId, userId: friend }));
    jsonOf(await call('share-note', { noteId, userId: friend }));
    expect(await isShared()).toBe(1);
    jsonOf(await call('unshare-note', { noteId, userId: friend }));
    expect(await isShared()).toBe(0);
    const own = await call('share-note', { noteId, userId: ownerId });
    expect(textOf(own)).toMatch(/^RULE_VIOLATION: /);
  });

  it('bad input is a tool error naming the field, not a crash', async () => {
    const r = await call('create-note', { ownerId: 'not-a-uuid', title: 'x' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/ownerId/);
  });
});
