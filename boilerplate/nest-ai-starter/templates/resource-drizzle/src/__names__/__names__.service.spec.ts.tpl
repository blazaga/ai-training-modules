import { NotFoundError } from '../common/errors/domain-error.js';
import { connectInMemory, type Connection } from '../database/connect.js';
import { Drizzle__Names__Repository } from './__names__.drizzle-repository.js';
import { __Names__Service } from './__names__.service.js';
import { __namesCamel__ } from './__names__.table.js';

/**
 * Unit tests against a REAL database (SQLite in memory, migrated): the
 * repository's SQL is exercised, not mocked. One database per file.
 */
describe('__Names__Service', () => {
  let connection: Connection;
  let service: __Names__Service;

  // AI-FILL(valid-input): a minimal valid create payload for one __name__.
  const valid = {} as never;

  beforeAll(async () => {
    connection = await connectInMemory();
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await connection.db.delete(__namesCamel__);
    service = new __Names__Service(
      new Drizzle__Names__Repository(connection.db),
    );
  });

  it('creates and reads back one __name__', async () => {
    const created = await service.create(valid);
    await expect(service.findOne(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(
      service.findOne('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes one __name__', async () => {
    const created = await service.create(valid);
    await service.remove(created.id);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  // AI-FILL(rule-tests): one test per business rule in the service: the allowed case
  // AND the refused case (expect the specific DomainError subclass). Each test must
  // FAIL if the rule is deleted from the service; check that by deleting it once.
});
