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

/**
 * zod renders `.nullable()` as `anyOf: [{ type: 'string', ... }, { type: 'null' }]`
 * with NO top-level `type`. @nestjs/swagger reads a missing `type` as a class
 * reference and throws "A circular dependency has been detected (property key: …)"
 * while building the document, which fails every e2e suite (measured,
 * @nestjs/swagger 12.0.4, on users.phone). Collapse it to the OpenAPI 3.0 form:
 * the non-null branch plus `nullable: true`.
 */
function collapseNullable(
  prop: Record<string, unknown>,
): Record<string, unknown> {
  const anyOf = prop.anyOf as Record<string, unknown>[] | undefined;
  if (prop.type !== undefined || !Array.isArray(anyOf)) return prop;
  const nonNull = anyOf.filter((branch) => branch.type !== 'null');
  if (nonNull.length !== 1 || nonNull.length === anyOf.length) return prop;
  const rest = { ...prop };
  delete rest.anyOf;
  return { ...rest, ...nonNull[0], nullable: true };
}

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
          { ...collapseNullable(prop), required: required.has(key) },
        ]),
      );
    }
  }
  return Dto as unknown as ZodDto<S>;
}
