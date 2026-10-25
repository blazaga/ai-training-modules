import { z } from 'zod';

/**
 * A class whose static `schema` is a zod schema and whose instances have the
 * schema's OUTPUT type. Controllers type parameters with it; ZodValidationPipe
 * finds `schema` on the parameter's metatype and validates against it.
 *
 * Why this file exists instead of the `nestjs-zod` package: no release of
 * nestjs-zod (5.5.0, and its `next` tag) declares support for Nest 12. Its
 * peer range is @nestjs/common ^10 || ^11. This adapter is the ~60 lines the
 * starter actually used. Revisit when nestjs-zod supports Nest 12.
 */
export interface ZodDto<S extends z.ZodType> {
  new (): z.output<S>;
  readonly schema: S;
}

export function isZodDto(value: unknown): value is ZodDto<z.ZodType> {
  return (
    typeof value === 'function' &&
    (value as { schema?: unknown }).schema instanceof z.ZodType
  );
}

/** JSON Schema property → the shape @nestjs/swagger's model explorer reads. */
type SwaggerProperty = Record<string, unknown> & { required: boolean };

/** `class CreateNoteDto extends createZodDto(CreateNoteSchema) {}` */
export function createZodDto<S extends z.ZodType>(schema: S): ZodDto<S> {
  class Dto {
    static readonly schema = schema;

    /**
     * Hook @nestjs/swagger calls on DTO classes to learn their properties.
     * Generated from the same zod schema, so docs cannot drift from validation.
     */
    static _OPENAPI_METADATA_FACTORY(): Record<string, SwaggerProperty> {
      const json = z.toJSONSchema(schema, {
        io: 'input',
        unrepresentable: 'any',
      }) as {
        properties?: Record<string, Record<string, unknown>>;
        required?: string[];
      };
      const required = new Set(json.required ?? []);
      return Object.fromEntries(
        Object.entries(json.properties ?? {}).map(([key, prop]) => [
          key,
          { ...prop, required: required.has(key) },
        ]),
      );
    }
  }
  return Dto as unknown as ZodDto<S>;
}
