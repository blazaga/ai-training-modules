import type { z } from 'zod';
import type { NoteResponseSchema, NoteSchema } from '../note.schema.js';

/** Derived from the schemas: never hand-write fields here. */
export type Note = z.infer<typeof NoteSchema>;

/** A Note without its private fields: the only shape that leaves the API. */
export type NoteResponse = z.infer<typeof NoteResponseSchema>;
