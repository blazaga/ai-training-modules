import { ConflictError, NotFoundError } from '../common/errors/domain-error.js';
import { verifyPassword } from '../common/security/password.js';
import { connectPglite, type Connection } from '../database/connect.js';
import { DrizzleUsersRepository } from './users.drizzle-repository.js';
import { UsersService } from './users.service.js';
import { users } from './users.table.js';

/**
 * Unit tests against REAL Postgres (PGlite, in memory, migrated): the
 * repository's SQL is exercised, not mocked. One database per file.
 */
describe('UsersService', () => {
  let connection: Connection;
  let service: UsersService;

  // Parsed shape (email already lower-cased), as the pipe hands it to the service.
  const valid = {
    email: 'ada@example.com',
    name: 'Ada',
    status: 'active' as const,
    password: 'correct horse battery',
  };

  beforeAll(async () => {
    connection = await connectPglite();
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await connection.db.delete(users);
    service = new UsersService(new DrizzleUsersRepository(connection.db));
  });

  it('creates and reads back a user', async () => {
    const created = await service.create(valid);
    await expect(service.findOne(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(
      service.findOne('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes a user', async () => {
    const created = await service.create(valid);
    await service.remove(created.id);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('R1: a second user with the same email is a ConflictError', async () => {
    await service.create(valid);
    await expect(service.create(valid)).rejects.toBeInstanceOf(ConflictError);
  });

  it('R2: stores a scrypt hash that verifies, never the password itself', async () => {
    const created = await service.create(valid);
    expect(created.passwordHash).not.toContain(valid.password);
    expect(created).not.toHaveProperty('password');
    await expect(
      verifyPassword(valid.password, created.passwordHash),
    ).resolves.toBe(true);
  });

  it('findByEmail finds the stored user by its lower-cased email', async () => {
    const created = await service.create(valid);
    const repo = new DrizzleUsersRepository(connection.db);
    await expect(repo.findByEmail('ada@example.com')).resolves.toEqual(created);
    await expect(
      repo.findByEmail('nobody@example.com'),
    ).resolves.toBeUndefined();
  });
});
