import { NotFoundError } from '../common/errors/domain-error.js';
import { InMemoryRepository } from '../common/persistence/repository.js';
import { __Names__Service } from './__names__.service.js';
import type { __Name__ } from './entities/__name__.entity.js';

/** Unit tests: plain constructor injection, no Nest container needed. */
describe('__Names__Service', () => {
  let service: __Names__Service;

  // AI-FILL(valid-input): a minimal valid create payload for a __name__.
  const valid = {} as never;

  beforeEach(() => {
    service = new __Names__Service(new InMemoryRepository<__Name__>());
  });

  it('creates and reads back a __name__', async () => {
    const created = await service.create(valid);
    await expect(service.findOne(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(
      service.findOne('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes a __name__', async () => {
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
