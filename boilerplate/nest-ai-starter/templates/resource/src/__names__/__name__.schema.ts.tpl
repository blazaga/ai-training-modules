import { z } from 'zod';
import { patchSchema } from '../common/schemas/patch-schema.js';

/**
 * Single source of truth for a __Name__ AS STORED: validation, TypeScript types
 * and the OpenAPI schema all derive from these definitions. Change fields HERE only.
 */
export const __Name__Schema = z.object({
  id: z.string().uuid(),
  // AI-FILL(fields): declare every __name__ field from the spec with its constraints
  // (z.string().min().max(), z.enum([...]), .default(...)). One line per field, each
  // with a short comment if the constraint is not obvious. Include private fields.
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Stored but never RETURNED and never ACCEPTED from a client (a password or
 * secret hash). Responses are parsed through __Name__ResponseSchema, which
 * strips these. A test checks that no response carries them.
 */
const PRIVATE = {
  // AI-FILL(private-fields): one `fieldName: true` per private field from the spec.
  // If the spec has none, delete this comment and leave the object empty.
} as const;

/** What every endpoint returns. */
export const __Name__ResponseSchema = __Name__Schema.omit(PRIVATE);

/**
 * Client-settable fields, UNREFINED. Zod 4 throws on .omit()/.partial() of a
 * refined object, so derive from this and attach .refine() last.
 */
const __Name__Fields = __Name__Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ...PRIVATE,
});

/** POST body. */
export const Create__Name__Schema = __Name__Fields;
// AI-FILL(payload-rules): write-only inputs (e.g. a plain `password` the service
// turns into a private hash) go here as `.extend({ ... })`; rules that need only
// the request payload as `.refine(fn, { message, path })`, chained onto
// __Name__Fields above. Rules needing stored state go in the service. If none,
// delete this comment.

/**
 * PATCH body: any subset of the create fields, never empty, and WITHOUT defaults
 * (see patchSchema: .partial() would overwrite stored values with defaults).
 */
export const Update__Name__Schema = patchSchema(__Name__Fields);
