import { InMemoryRepository } from '../common/persistence/repository.js';
import type { NotesRepository } from './notes.repository.js';
import type { Note } from './entities/note.entity.js';

/** In-memory storage for notes: used by the module and by unit tests. */
export class InMemoryNotesRepository
  extends InMemoryRepository<Note>
  implements NotesRepository {}
