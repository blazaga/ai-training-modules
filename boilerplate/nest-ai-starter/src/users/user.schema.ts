import { z } from 'zod';
import { patchSchema } from '../common/schemas/patch-schema.js';

/**
 * Single source of truth for a User AS STORED: validation, TypeScript types
 * and the OpenAPI schema all derive from these definitions. Change fields HERE only.
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  // Spec R1: stored lower-cased, so uniqueness is case-insensitive.
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(100),
  status: z.enum(['active', 'disabled']).default('active'),
  passwordHash: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Stored but never RETURNED and never ACCEPTED from a client (a password or
 * secret hash). Responses are parsed through UserResponseSchema, which
 * strips these. A test checks that no response carries them.
 */
const PRIVATE = {
  passwordHash: true,
} as const;

/**
 * Returned to clients but never ACCEPTED from them: the server sets these, usually
 * through actions (e.g. `status` only changes via POST /:id/activate).
 */
const SERVER_OWNED = {} as const;

/** What every endpoint returns. */
export const UserResponseSchema = UserSchema.omit(PRIVATE);

/**
 * Client-settable fields, UNREFINED. Zod 4 throws on .omit()/.partial() of a
 * refined object, so derive from this and attach .refine() last.
 */
const UserFields = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ...PRIVATE,
  ...SERVER_OWNED,
});

/** POST body. */
export const CreateUserSchema = UserFields.extend({
  // Write-only: hashed by the service (spec R2), never stored or returned as given.
  password: z.string().min(8).max(128),
});

/**
 * PATCH body: any subset of the create fields, never empty, and WITHOUT defaults
 * (see patchSchema: .partial() would overwrite stored values with defaults).
 */
export const UpdateUserSchema = patchSchema(UserFields);
