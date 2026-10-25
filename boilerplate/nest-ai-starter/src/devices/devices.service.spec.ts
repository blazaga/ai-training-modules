import {
  NotFoundError,
  RuleViolationError,
} from '../common/errors/domain-error.js';
import { connectPglite, type Connection } from '../database/connect.js';
import { DrizzleDevicesRepository } from './devices.drizzle-repository.js';
import { DevicesService } from './devices.service.js';
import { devices } from './devices.table.js';
import { users } from '../users/users.table.js';

/**
 * Unit tests against REAL Postgres (PGlite, in memory, migrated): the
 * repository's SQL is exercised, not mocked. One database per file.
 */
describe('DevicesService', () => {
  let connection: Connection;
  let service: DevicesService;

  // Parsed shape (defaults applied), as the pipe hands it to the service.
  const valid = { name: 'Sensor 1', description: '' };

  /** Two real users: devices.owner_user_id is a foreign key. */
  let owner: string;
  let stranger: string;

  beforeAll(async () => {
    connection = await connectPglite();
    const [a, b] = await connection.db
      .insert(users)
      .values([
        { email: 'owner@example.com', name: 'Owner', passwordHash: 'x' },
        { email: 'stranger@example.com', name: 'Stranger', passwordHash: 'x' },
      ])
      .returning({ id: users.id });
    owner = a.id;
    stranger = b.id;
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await connection.db.delete(devices);
    service = new DevicesService(new DrizzleDevicesRepository(connection.db));
  });

  it('creates and reads back a device', async () => {
    const created = await service.create(owner, valid);
    await expect(service.findOne(owner, created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(
      service.findOne(owner, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes a device', async () => {
    const created = await service.create(owner, valid);
    await service.remove(owner, created.id);
    await expect(service.findOne(owner, created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe('ownership (ch04b)', () => {
    it("another user's device is NOT FOUND, for every operation", async () => {
      const { id } = await service.create(owner, valid);
      for (const attempt of [
        () => service.findOne(stranger, id),
        () => service.update(stranger, id, { name: 'x' }),
        () => service.remove(stranger, id),
        () => service.issueCredentials(stranger, id),
        () => service.activate(stranger, id),
        () => service.archive(stranger, id),
      ]) {
        await expect(attempt()).rejects.toBeInstanceOf(NotFoundError);
      }
    });

    it('lists only the caller’s devices', async () => {
      await service.create(owner, valid);
      await service.create(stranger, valid);
      const mine = await service.findPage(owner, 20, 0);
      expect(mine.total).toBe(1);
      expect(mine.items.every((d) => d.ownerUserId === owner)).toBe(true);
    });
  });

  it('a new device is a draft without credentials', async () => {
    const created = await service.create(owner, valid);
    expect(created).toMatchObject({
      status: 'draft',
      accessKeyId: null,
      secretHash: null,
    });
  });

  describe('credentials', () => {
    it('issue: the secret is returned once and only its hash is stored', async () => {
      const { id } = await service.create(owner, valid);
      const issued = await service.issueCredentials(owner, id);
      expect(issued.accessKeyId).toMatch(/^AKID[A-Z2-7]{16}$/);
      expect(issued.secret).toMatch(/^dsk_/);
      const stored = await service.findOne(owner, id);
      expect(stored.secretHash).not.toContain(issued.secret.slice(4));
      expect(stored.secretLast4).toBe(issued.secret.slice(-4));
      expect(JSON.stringify(stored)).not.toContain(issued.secret);
    });

    it('only an ACTIVE device authenticates; success records lastUsedAt', async () => {
      const { id } = await service.create(owner, valid);
      const { accessKeyId, secret } = await service.issueCredentials(owner, id);
      await expect(
        service.verifyAccessKey(accessKeyId, secret),
      ).resolves.toBeUndefined(); // still a draft
      await service.activate(owner, id);
      const device = await service.verifyAccessKey(accessKeyId, secret);
      expect(device?.id).toBe(id);
      expect(device?.lastUsedAt).not.toBeNull();
    });

    it('rotation keeps the key id and invalidates the old secret IMMEDIATELY', async () => {
      const { id } = await service.create(owner, valid);
      const first = await service.issueCredentials(owner, id);
      await service.activate(owner, id);
      const second = await service.issueCredentials(owner, id);
      expect(second.accessKeyId).toBe(first.accessKeyId);
      await expect(
        service.verifyAccessKey(first.accessKeyId, first.secret),
      ).resolves.toBeUndefined();
      await expect(
        service.verifyAccessKey(second.accessKeyId, second.secret),
      ).resolves.toBeDefined();
    });

    it('an unknown key id or a wrong secret is undefined', async () => {
      const { id } = await service.create(owner, valid);
      const { accessKeyId } = await service.issueCredentials(owner, id);
      await service.activate(owner, id);
      await expect(
        service.verifyAccessKey('AKIDAAAAAAAAAAAAAAAA', 'dsk_x'),
      ).resolves.toBeUndefined();
      await expect(
        service.verifyAccessKey(accessKeyId, 'dsk_wrong'),
      ).resolves.toBeUndefined();
    });

    it('R2: no credentials for an archived device', async () => {
      const { id } = await service.create(owner, valid);
      await service.archive(owner, id);
      await expect(service.issueCredentials(owner, id)).rejects.toBeInstanceOf(
        RuleViolationError,
      );
    });
  });

  it('R3: activation needs credentials and a non-archived device', async () => {
    const { id } = await service.create(owner, valid);
    await expect(service.activate(owner, id)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
    await service.issueCredentials(owner, id);
    await service.archive(owner, id);
    await expect(service.activate(owner, id)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
  });

  it('R4: an active device cannot be deleted', async () => {
    const { id } = await service.create(owner, valid);
    await service.issueCredentials(owner, id);
    await service.activate(owner, id);
    await expect(service.remove(owner, id)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
  });

  it('R5: archive is a soft delete; an archived device cannot be edited or used', async () => {
    const { id } = await service.create(owner, valid);
    const { accessKeyId, secret } = await service.issueCredentials(owner, id);
    await service.activate(owner, id);
    const archived = await service.archive(owner, id);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).not.toBeNull();
    await expect(service.findOne(owner, id)).resolves.toBeDefined(); // still there
    await expect(
      service.update(owner, id, { name: 'x' }),
    ).rejects.toBeInstanceOf(RuleViolationError);
    await expect(
      service.verifyAccessKey(accessKeyId, secret),
    ).resolves.toBeUndefined();
  });
});
