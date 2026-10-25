import type { z } from 'zod';
import type {
  __Name__ResponseSchema,
  __Name__Schema,
} from '../__name__.schema.js';

/** Derived from the schemas: never hand-write fields here. */
export type __Name__ = z.infer<typeof __Name__Schema>;

/** A __Name__ without its private fields: the only shape that leaves the API. */
export type __Name__Response = z.infer<typeof __Name__ResponseSchema>;
