import { type LabApp, startApp } from './lab-harness.js';

/**
 * Lab 01 (module 1): the users and notes resources over REST (specs/users.md, specs/notes.md).
 * Runs on an EMPTY in-memory database, so every row here is created by the check itself.
 */
describe('Lab 01 · users and notes', () => {
  let lab: LabApp;
  let n = 0;
  const users = '/api/v1/users';
  const notes = '/api/v1/notes';

  beforeAll(async () => {
    lab = await startApp();
  });
  afterAll(() => lab?.close());

  const user = async (name = 'Lab User') => {
    const res = await lab
      .rest()
      .post(users)
      .send({ email: `Lab01-${++n}@Example.com`, name });
    expect(res.status, `POST ${users}: ${JSON.stringify(res.body)}`).toBe(201);
    return res.body as { id: string; email: string; name: string };
  };
  const note = async (ownerId: string, extra: Record<string, unknown> = {}) => {
    const res = await lab
      .rest()
      .post(notes)
      .send({ ownerId, title: `Note ${++n}`, ...extra });
    expect(res.status, `POST ${notes}: ${JSON.stringify(res.body)}`).toBe(201);
    return res.body as Record<string, unknown> & { id: string };
  };

  describe('users', () => {
    it('create → 201 with the email stored lower-case and server fields set', async () => {
      const u = await user('  Ada Lovelace  ');
      expect(u.email).toBe(u.email.toLowerCase());
      expect(u.name, 'name is trimmed').toBe('Ada Lovelace');
      expect(u).toHaveProperty('id');
      expect(u).toHaveProperty('createdAt');
    });

    it('R1: the same email in another case → 409', async () => {
      const u = await user();
      await lab
        .rest()
        .post(users)
        .send({ email: u.email.toUpperCase(), name: 'Twin' })
        .expect(409);
    });

    it('list, get, patch, and a malformed or unknown id', async () => {
      const u = await user();
      const list = await lab.rest().get(users).expect(200);
      expect(list.body.items.map((x: { id: string }) => x.id)).toContain(u.id);
      await lab.rest().get(`${users}/${u.id}`).expect(200);
      const patched = await lab
        .rest()
        .patch(`${users}/${u.id}`)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(patched.body.name).toBe('Renamed');
      await lab.rest().get(`${users}/not-a-uuid`).expect(400);
      await lab
        .rest()
        .get(`${users}/00000000-0000-4000-8000-000000000000`)
        .expect(404);
    });

    it('R2: a user who owns notes cannot be deleted (409); one who owns none can (204)', async () => {
      const owner = await user();
      await note(owner.id);
      await lab.rest().delete(`${users}/${owner.id}`).expect(409);
      const free = await user();
      await lab.rest().delete(`${users}/${free.id}`).expect(204);
    });
  });

  describe('notes', () => {
    it('create → 201 with defaults: body "", status open, dueAt null', async () => {
      const owner = await user();
      const nt = await note(owner.id);
      expect(nt).toMatchObject({
        ownerId: owner.id,
        body: '',
        status: 'open',
        dueAt: null,
      });
    });

    it('R1: an owner that does not exist → 422', async () => {
      await lab
        .rest()
        .post(notes)
        .send({ ownerId: '00000000-0000-4000-8000-000000000000', title: 'x' })
        .expect(422);
    });

    it('R3: dueAt with an offset is stored and returned as UTC toISOString()', async () => {
      const owner = await user();
      const nt = await note(owner.id, { dueAt: '2026-11-01T09:00:00+08:00' });
      expect(nt.dueAt).toBe('2026-11-01T01:00:00.000Z');
      await lab
        .rest()
        .post(notes)
        .send({ ownerId: owner.id, title: 'x', dueAt: 'next tuesday' })
        .expect(400);
    });

    it('a PATCH cannot change the owner (ownerId is ignored)', async () => {
      const owner = await user();
      const other = await user();
      const nt = await note(owner.id);
      const res = await lab
        .rest()
        .patch(`${notes}/${nt.id}`)
        .send({ ownerId: other.id, title: 'Still mine' })
        .expect(200);
      expect(res.body.ownerId).toBe(owner.id);
    });

    it('R2: a done note can only be reopened; then it can be edited again', async () => {
      const owner = await user();
      const nt = await note(owner.id, { status: 'done' });
      await lab
        .rest()
        .patch(`${notes}/${nt.id}`)
        .send({ title: 'Changed' })
        .expect(422);
      await lab
        .rest()
        .patch(`${notes}/${nt.id}`)
        .send({ status: 'open' })
        .expect(200);
      const res = await lab
        .rest()
        .patch(`${notes}/${nt.id}`)
        .send({ title: 'Changed' })
        .expect(200);
      expect(res.body.title).toBe('Changed');
    });

    it('list filters ownerId and status, combined with AND', async () => {
      const owner = await user();
      await note(owner.id);
      await note(owner.id, { status: 'done' });
      const res = await lab
        .rest()
        .get(notes)
        .query({ ownerId: owner.id, status: 'done' })
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        ownerId: owner.id,
        status: 'done',
      });
    });

    it('DELETE → 204, then 404', async () => {
      const owner = await user();
      const nt = await note(owner.id);
      await lab.rest().delete(`${notes}/${nt.id}`).expect(204);
      await lab.rest().get(`${notes}/${nt.id}`).expect(404);
    });
  });

  describe('sharing', () => {
    it('PUT shares (idempotent), GET lists the users, sharedWith filters the list', async () => {
      const owner = await user();
      const friend = await user('Friend');
      const nt = await note(owner.id);
      await lab.rest().put(`${notes}/${nt.id}/shares/${friend.id}`).expect(204);
      await lab.rest().put(`${notes}/${nt.id}/shares/${friend.id}`).expect(204);
      const shares = await lab
        .rest()
        .get(`${notes}/${nt.id}/shares`)
        .expect(200);
      expect(shares.body.items.map((u: { id: string }) => u.id)).toEqual([
        friend.id,
      ]);
      const shared = await lab
        .rest()
        .get(notes)
        .query({ sharedWith: friend.id })
        .expect(200);
      expect(shared.body.items.map((x: { id: string }) => x.id)).toEqual([
        nt.id,
      ]);
    });

    it('R4: sharing with the owner → 422; an unknown user or note → 404', async () => {
      const owner = await user();
      const nt = await note(owner.id);
      await lab.rest().put(`${notes}/${nt.id}/shares/${owner.id}`).expect(422);
      await lab
        .rest()
        .put(`${notes}/${nt.id}/shares/00000000-0000-4000-8000-000000000000`)
        .expect(404);
      await lab
        .rest()
        .put(`${notes}/00000000-0000-4000-8000-000000000000/shares/${owner.id}`)
        .expect(404);
    });

    it('DELETE unshares (204); unsharing again → 404', async () => {
      const owner = await user();
      const friend = await user();
      const nt = await note(owner.id);
      await lab.rest().put(`${notes}/${nt.id}/shares/${friend.id}`).expect(204);
      await lab
        .rest()
        .delete(`${notes}/${nt.id}/shares/${friend.id}`)
        .expect(204);
      await lab
        .rest()
        .delete(`${notes}/${nt.id}/shares/${friend.id}`)
        .expect(404);
    });

    it('deleting a shared note removes its shares; deleting a friend keeps the note', async () => {
      const owner = await user();
      const friend = await user();
      const nt = await note(owner.id);
      await lab.rest().put(`${notes}/${nt.id}/shares/${friend.id}`).expect(204);
      await lab.rest().delete(`${users}/${friend.id}`).expect(204);
      const shares = await lab
        .rest()
        .get(`${notes}/${nt.id}/shares`)
        .expect(200);
      expect(shares.body.items).toEqual([]);
      await lab.rest().get(`${notes}/${nt.id}`).expect(200);
    });
  });
});
