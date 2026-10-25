import {
  NotFoundError,
  RuleViolationError,
} from '../common/errors/domain-error';
import { InMemoryRepository } from '../common/persistence/repository';
import { NotesService } from './notes.service';
import type { Note } from './entities/note.entity';

/** Unit tests: plain constructor injection, no Nest container needed. */
describe('NotesService', () => {
  let service: NotesService;

  // Parsed shape (defaults applied), as the validation pipe hands it to the service.
  const valid = {
    title: 'First note',
    body: 'Hello',
    status: 'draft' as const,
    tags: [],
  };
  const publish = async () => service.create({ ...valid, status: 'published' });

  beforeEach(() => {
    service = new NotesService(new InMemoryRepository<Note>());
  });

  it('creates and reads back a note', async () => {
    const created = await service.create(valid);
    await expect(service.findOne(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(
      service.findOne('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes a note', async () => {
    const created = await service.create(valid);
    await service.remove(created.id);
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe('R3: published title is frozen', () => {
    it('refuses a title change on a published note', async () => {
      const note = await publish();
      await expect(
        service.update(note.id, { title: 'Renamed' }),
      ).rejects.toBeInstanceOf(RuleViolationError);
    });

    it('allows a title change on a draft', async () => {
      const note = await service.create(valid);
      await expect(
        service.update(note.id, { title: 'Renamed' }),
      ).resolves.toMatchObject({
        title: 'Renamed',
      });
    });

    it('allows re-sending the same title on a published note', async () => {
      const note = await publish();
      await expect(
        service.update(note.id, { title: note.title }),
      ).resolves.toBeDefined();
    });
  });

  describe('R4: published never returns to draft', () => {
    it('refuses published -> draft', async () => {
      const note = await publish();
      await expect(
        service.update(note.id, { status: 'draft' }),
      ).rejects.toBeInstanceOf(RuleViolationError);
    });
  });

  describe('R5: publishing via PATCH needs a body', () => {
    it('refuses publishing a draft whose stored body is empty', async () => {
      const note = await service.create({ ...valid, body: '' });
      await expect(
        service.update(note.id, { status: 'published' }),
      ).rejects.toBeInstanceOf(RuleViolationError);
    });

    it('allows publishing when the patch supplies the body', async () => {
      const note = await service.create({ ...valid, body: '' });
      await expect(
        service.update(note.id, { status: 'published', body: 'Now filled' }),
      ).resolves.toMatchObject({ status: 'published' });
    });
  });

  it('a partial update keeps the fields it did not mention', async () => {
    const note = await service.create({ ...valid, tags: ['keep'] });
    await expect(
      service.update(note.id, { title: 'Renamed' }),
    ).resolves.toMatchObject({
      body: 'Hello',
      tags: ['keep'],
    });
  });
});
