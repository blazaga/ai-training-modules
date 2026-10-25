import { z } from 'zod';
import { patchSchema } from '../common/schemas/patch-schema.js';

/**
 * Single source of truth for a __Name__: validation, TypeScript types and the
 * OpenAPI schema all derive from these definitions. Change fields HERE only.
 */
export const __Name__Schema = z.object({
  id: z.string().uuid(),
  // AI-FILL(fields): declare every __name__ field from the spec with its constraints
  // (z.string().min().max(), z.enum([...]), .default(...)). One line per field, each
  // with a short comment if the constraint is not obvious.
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Client-settable fields, UNREFINED. Zod 4 throws on .omit()/.partial() of a
 * refined object, so derive from this and attach .refine() last.
 */
const __Name__Fields = __Name__Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** POST body. */
export const Create__Name__Schema = __Name__Fields;
// AI-FILL(payload-rules): rules that need only the request payload (cross-field
// checks) go here as `.refine(fn, { message, path })` chained onto __Name__Fields
// above. Rules that need stored state go in the service. If none, delete this comment.

/**
 * PATCH body: any subset of the create fields, never empty, and WITHOUT defaults
 * (see patchSchema: .partial() would overwrite stored values with defaults).
 */
export const Update__Name__Schema = patchSchema(__Name__Fields);
