import { z } from 'zod';
import { patchSchema } from '../common/schemas/patch-schema.js';

/**
 * Single source of truth for a Device AS STORED: validation, TypeScript types
 * and the OpenAPI schema all derive from these definitions. Change fields HERE only.
 */
export const DeviceSchema = z.object({
  id: z.string().uuid(),
  /** ch04b: the user who created the device. Server-owned. */
  ownerUserId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(''),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  accessKeyId: z
    .string()
    .regex(/^AKID[A-Z2-7]{16}$/)
    .nullable(),
  secretHash: z.string().nullable(),
  secretLast4: z.string().nullable(),
  secretRotatedAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Stored but never RETURNED and never ACCEPTED from a client (a password or
 * secret hash). Responses are parsed through DeviceResponseSchema, which
 * strips these. A test checks that no response carries them.
 */
const PRIVATE = {
  secretHash: true,
} as const;

/**
 * Returned to clients but never ACCEPTED from them: the server sets these, usually
 * through actions (e.g. `status` only changes via POST /:id/activate).
 */
const SERVER_OWNED = {
  ownerUserId: true,
  status: true,
  accessKeyId: true,
  secretLast4: true,
  secretRotatedAt: true,
  lastUsedAt: true,
  archivedAt: true,
} as const;

/** What every endpoint returns. */
export const DeviceResponseSchema = DeviceSchema.omit(PRIVATE);

/**
 * Client-settable fields, UNREFINED. Zod 4 throws on .omit()/.partial() of a
 * refined object, so derive from this and attach .refine() last.
 */
const DeviceFields = DeviceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ...PRIVATE,
  ...SERVER_OWNED,
});

/** POST body. */
export const CreateDeviceSchema = DeviceFields;

/**
 * PATCH body: any subset of the create fields, never empty, and WITHOUT defaults
 * (see patchSchema: .partial() would overwrite stored values with defaults).
 */
export const UpdateDeviceSchema = patchSchema(DeviceFields);
