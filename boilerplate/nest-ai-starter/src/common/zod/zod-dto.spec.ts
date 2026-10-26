import { z } from 'zod';
import { createZodDto } from './zod-dto.js';

/** What @nestjs/swagger reads to document a DTO. */
const openApi = (schema: z.ZodType) =>
  (
    createZodDto(schema) as unknown as {
      _OPENAPI_METADATA_FACTORY(): Record<string, Record<string, unknown>>;
    }
  )._OPENAPI_METADATA_FACTORY();

describe('createZodDto OpenAPI metadata', () => {
  it('gives a nullable field a top-level type (swagger throws without one)', () => {
    const props = openApi(
      z.object({
        phone: z
          .string()
          .regex(/^\+\d+$/)
          .nullable()
          .default(null),
      }),
    );
    expect(props.phone).toMatchObject({
      type: 'string',
      pattern: '^\\+\\d+$',
      nullable: true,
      default: null,
      required: false,
    });
    expect(props.phone).not.toHaveProperty('anyOf');
  });

  it('leaves a non-nullable field and a real union alone', () => {
    const props = openApi(
      z.object({
        name: z.string(),
        either: z.union([
          z.object({ a: z.string() }),
          z.object({ b: z.number() }),
        ]),
      }),
    );
    expect(props.name).toEqual({ type: 'string', required: true });
    expect(props.either).toHaveProperty('anyOf');
  });
});
