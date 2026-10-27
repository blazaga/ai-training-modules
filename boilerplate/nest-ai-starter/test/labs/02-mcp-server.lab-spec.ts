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
  const READ_TOOLS = [
    'describe-table',
    'list-tables',
    'notes-for-user',
    'query',
  ];
  const WRITE_TOOLS = [
    'create-note',
    'create-user',
    'delete-note',
    'execute',
    'share-note',
    'unshare-note',
    'update-note',
  ];
  const DESTRUCTIVE = ['delete-note', 'execute', 'unshare-note'];
  const NIL = '00000000-0000-4000-8000-000000000000';

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

  it('identifies as notes-db and lists exactly the read and write tools of the spec', async () => {
    expect(mcp.client.getServerVersion()?.name).toBe('notes-db');
    const { tools } = await mcp.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [...READ_TOOLS, ...WRITE_TOOLS].sort(),
    );
  });

  it('annotates which tools only read and which write or destroy', async () => {
    const { tools } = await mcp.client.listTools();
    for (const t of tools) {
      const a = t.annotations ?? {};
      expect(a.readOnlyHint, `${t.name} readOnlyHint`).toBe(
        READ_TOOLS.includes(t.name),
      );
      if (DESTRUCTIVE.includes(t.name)) {
        expect(a.destructiveHint, `${t.name} destructiveHint`).toBe(true);
      }
    }
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
      // a write behind a read-looking start: only the database itself can refuse this one
      'with x as (select 1) delete from notes',
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
      ownerId: NIL,
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
    const missing = await call('update-note', { id: NIL, title: 'x' });
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

  it('create-user stores a lower-cased email; a taken email is CONFLICT', async () => {
    const email = `Lab.User.${Date.now()}@Example.com`;
    const created = jsonOf<{ id: string; email: string }>(
      await call('create-user', { email, name: 'Lab User' }),
    );
    expect(created.email).toBe(email.toLowerCase());
    expect(
      await scalar(mcp.db, 'select email from users where id = ?', [
        created.id,
      ]),
    ).toBe(email.toLowerCase());
    const before = await count('users');
    const twin = await call('create-user', { email, name: 'Twin' });
    expect(twin.isError).toBe(true);
    expect(textOf(twin)).toMatch(/^CONFLICT: /);
    expect(await count('users')).toBe(before);
  });

  it('delete-note removes the note and its shares; a missing note is NOT_FOUND', async () => {
    const noteId = String(
      await scalar(mcp.db, 'select note_id from note_shares limit 1'),
    );
    const res = jsonOf<{ id: string; deleted: boolean }>(
      await call('delete-note', { id: noteId }),
    );
    expect(res).toEqual({ id: noteId, deleted: true });
    expect(await count(`notes where id = '${noteId}'`)).toBe(0);
    expect(await count(`note_shares where note_id = '${noteId}'`)).toBe(0);
    const missing = await call('delete-note', { id: NIL });
    expect(textOf(missing)).toMatch(/^NOT_FOUND: /);
  });

  it('execute runs one INSERT, UPDATE or DELETE and reports rowsAffected', async () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const now = new Date().toISOString();
    const inserted = jsonOf<{ rowsAffected: number }>(
      await call('execute', {
        sql: `insert into users (id, email, name, created_at, updated_at) values ('${id}', 'sql.lab@example.com', 'SQL Lab', '${now}', '${now}')`,
      }),
    );
    expect(inserted.rowsAffected).toBe(1);
    expect(await count(`users where id = '${id}'`)).toBe(1);
    const updated = jsonOf<{ rowsAffected: number }>(
      await call('execute', {
        sql: `update users set name = 'Renamed by SQL' where id = '${id}'`,
      }),
    );
    expect(updated.rowsAffected).toBe(1);
    expect(
      await scalar(mcp.db, 'select name from users where id = ?', [id]),
    ).toBe('Renamed by SQL');
    const deleted = jsonOf<{ rowsAffected: number }>(
      await call('execute', { sql: `delete from users where id = '${id}'` }),
    );
    expect(deleted.rowsAffected).toBe(1);
    expect(await count(`users where id = '${id}'`)).toBe(0);
  });

  it('execute refuses everything else with NOT_ALLOWED, and nothing changes', async () => {
    const tables = async () => ({
      users: await count('users'),
      notes: await count('notes'),
      shares: await count('note_shares'),
      schema: Number(
        await scalar(mcp.db, 'select count(*) from sqlite_master'),
      ),
    });
    const before = await tables();
    for (const sql of [
      'delete from notes',
      "update notes set status = 'done'",
      'drop table note_shares',
      'create table x (a)',
      'alter table notes add column x text',
      'pragma foreign_keys = off',
      'select * from users',
      // each has a WHERE, so only the statement-type check refuses it
      'select * from users where 1 = 1',
      'create view open_notes as select * from notes where 1 = 1',
      "delete from note_shares where note_id = 'x'; delete from notes where 1 = 1",
    ]) {
      const r = await call('execute', { sql });
      expect(r.isError, `"${sql}" must be refused`).toBe(true);
      expect(textOf(r), sql).toMatch(/^NOT_ALLOWED: /);
    }
    expect(await tables()).toEqual(before);
  });

  it('execute keeps foreign keys on: an unknown owner is CONSTRAINT', async () => {
    const before = await count('notes');
    const now = new Date().toISOString();
    const r = await call('execute', {
      sql: `insert into notes (id, owner_id, title, body, status, created_at, updated_at) values ('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', '${NIL}', 'orphan', '', 'open', '${now}', '${now}')`,
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/^CONSTRAINT: /);
    expect(await count('notes')).toBe(before);
  });

  it('bad input is a tool error naming the field, not a crash', async () => {
    const r = await call('create-note', { ownerId: 'not-a-uuid', title: 'x' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/ownerId/);
  });
});
