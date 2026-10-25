import type { Repository } from '../common/persistence/repository.js';
import type { Note } from './entities/note.entity.js';

/** Injection token: services depend on the port, never on a storage class. */
export const NOTES_REPOSITORY = Symbol('NOTES_REPOSITORY');

/** The generic CRUD port plus the lookups this resource needs. */
export interface NotesRepository extends Repository<Note> {}
