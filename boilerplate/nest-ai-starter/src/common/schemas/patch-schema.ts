import { z } from 'zod';

/**
 * Build a PATCH schema from create fields: every field optional, defaults REMOVED,
 * and an empty body rejected.
 *
 * Why not `fields.partial()`: zod applies `.default()` inside a partial, so
 * `PATCH { title }` would parse to `{ title, body: '', status: 'draft', tags: [] }`
 * and silently overwrite stored values with defaults. Measured on zod 4.4.3.
 * The unit test in patch-schema.spec.ts pins this behaviour.
 */
export function patchSchema<S extends z.ZodRawShape>(fields: z.ZodObject<S>) {
  const shape = Object.fromEntries(
    Object.entries(fields.shape).map(([key, field]) => [
      key,
      z.optional(field instanceof z.ZodDefault ? field.unwrap() : field),
    ]),
  ) as {
    [K in keyof S]: z.ZodOptional<
      S[K] extends z.ZodDefault<infer I> ? I : S[K]
    >;
  };

  return z.object(shape).refine((patch) => Object.keys(patch).length > 0, {
    message: 'Provide at least one field to update',
  });
}
