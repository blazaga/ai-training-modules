import type { z } from 'zod';
import type { NoteSchema } from '../note.schema';

/** Derived from the schema: never hand-write fields here. */
export type Note = z.infer<typeof NoteSchema>;
