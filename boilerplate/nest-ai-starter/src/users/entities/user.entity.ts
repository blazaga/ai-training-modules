import type { z } from 'zod';
import type { UserResponseSchema, UserSchema } from '../user.schema.js';

/** Derived from the schemas: never hand-write fields here. */
export type User = z.infer<typeof UserSchema>;

/** A User without its private fields: the only shape that leaves the API. */
export type UserResponse = z.infer<typeof UserResponseSchema>;
