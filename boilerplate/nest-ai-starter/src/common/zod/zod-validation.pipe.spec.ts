import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';
import { createZodDto } from './zod-dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const Schema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int().default(1),
});
class ThingDto extends createZodDto(Schema) {}

const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('returns the PARSED value: defaults applied, coercion done, extras stripped', () => {
    expect(pipe.transform({ name: 'a', extra: true }, body(ThingDto))).toEqual({
      name: 'a',
      count: 1,
    });
    expect(pipe.transform({ name: 'a', count: '3' }, body(ThingDto))).toEqual({
      name: 'a',
      count: 3,
    });
  });

  it('throws 400 with issue paths, without echoing the input', () => {
    const secretLike = 'value-that-must-not-be-echoed';
    let error: unknown;
    try {
      pipe.transform({ name: '', count: secretLike }, body(ThingDto));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse();
    expect(JSON.stringify(response)).not.toContain(secretLike);
    expect(response).toMatchObject({
      statusCode: 400,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'count' }),
      ]),
    });
  });

  it('passes through parameters that are not zod DTOs', () => {
    expect(pipe.transform('raw', body(String))).toBe('raw');
    expect(pipe.transform('raw', body(undefined))).toBe('raw');
  });

  it('exposes OpenAPI properties generated from the same schema', () => {
    const factory = (
      ThingDto as unknown as {
        _OPENAPI_METADATA_FACTORY: () => Record<string, { required: boolean }>;
      }
    )._OPENAPI_METADATA_FACTORY();
    expect(factory.name).toMatchObject({ type: 'string', required: true });
    // `count` has a default, so a client may omit it.
    expect(factory.count).toMatchObject({ required: false });
  });
});
