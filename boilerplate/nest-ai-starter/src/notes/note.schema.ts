import { z } from 'zod';
import { patchSchema } from '../common/schemas/patch-schema.js';

/**
 * Single source of truth for a Note: validation, TypeScript types and the
 * OpenAPI schema all derive from these definitions. Change fields HERE only.
 */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10_000).default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  // Spec R1: tag shape, at most 10, no duplicates (payload-only, so it lives here).
  tags: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9-]{1,30}$/, 'lowercase a-z, 0-9 or "-", 1-30 chars'),
    )
    .max(10)
    .refine((tags) => new Set(tags).size === tags.length, {
      message: 'tags must be unique',
    })
    .default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Client-settable fields, UNREFINED. Zod 4 throws on .omit()/.partial() of a
 * refined object, so derive from this and attach .refine() last.
 */
const NoteFields = NoteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** POST body. */
export const CreateNoteSchema = NoteFields.refine(
  // Spec R2: a note created as published needs a body.
  (note) => note.status !== 'published' || note.body.length > 0,
  { message: 'a published note needs a non-empty body', path: ['body'] },
);

/**
 * PATCH body: any subset of the create fields, never empty, and WITHOUT defaults
 * (see patchSchema: .partial() would overwrite stored values with defaults).
 */
export const UpdateNoteSchema = patchSchema(NoteFields);
