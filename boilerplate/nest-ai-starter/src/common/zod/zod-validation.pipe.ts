import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { isZodDto } from './zod-dto.js';

/**
 * Global pipe: validates any @Body/@Query/@Param whose type was made with
 * createZodDto, and replaces the raw value with the PARSED one (defaults
 * applied, coercions done, unknown keys stripped). Other parameters pass
 * through untouched, so built-in pipes like ParseUUIDPipe still work.
 *
 * The 400 body keeps Nest's shape ({ statusCode, message, error }) and adds
 * `issues` as path + message only. The rejected input is never echoed back.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (!isZodDto(metadata.metatype)) return value;

    const result = metadata.metatype.schema.safeParse(value);
    if (result.success) return result.data;

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
