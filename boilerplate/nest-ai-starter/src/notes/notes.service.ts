import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  RuleViolationError,
} from '../common/errors/domain-error';
import type { Page } from '../common/persistence/repository';
import { NOTES_REPOSITORY, type NotesRepository } from './notes.repository';
import type { CreateNoteDto } from './dto/create-note.dto';
import type { UpdateNoteDto } from './dto/update-note.dto';
import type { Note } from './entities/note.entity';

/**
 * Business logic for notes. Shape rules (types, lengths, enums) live in the
 * schema. Only rules that need state or more than one field belong here, and
 * they fail by throwing a DomainError, never by returning a flag.
 */
@Injectable()
export class NotesService {
  constructor(
    @Inject(NOTES_REPOSITORY) private readonly repo: NotesRepository,
  ) {}

  create(input: CreateNoteDto): Promise<Note> {
    // No create-time rules: R1 and R2 are payload-only and live in the schema.
    return this.repo.create(input);
  }

  findPage(limit: number, offset: number): Promise<Page<Note>> {
    return this.repo.findPage(limit, offset);
  }

  async findOne(id: string): Promise<Note> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundError('Note', id);
    return found;
  }

  async update(id: string, patch: UpdateNoteDto): Promise<Note> {
    const current = await this.findOne(id);
    if (current.status === 'published') {
      // Spec R3: a published note's title is frozen.
      if (patch.title !== undefined && patch.title !== current.title) {
        throw new RuleViolationError(
          'A published note cannot change its title',
          { field: 'title' },
        );
      }
      // Spec R4: published never goes back to draft.
      if (patch.status === 'draft') {
        throw new RuleViolationError(
          'A published note cannot return to draft',
          { field: 'status' },
        );
      }
    }
    // Spec R5: publishing needs a non-empty body after the patch is applied.
    const nextStatus = patch.status ?? current.status;
    const nextBody = patch.body ?? current.body;
    if (nextStatus === 'published' && nextBody.length === 0) {
      throw new RuleViolationError('A published note needs a non-empty body', {
        field: 'body',
      });
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError('Note', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Note', id);
  }
}
