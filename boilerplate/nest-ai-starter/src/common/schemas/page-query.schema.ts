import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `?limit=&offset=` for every list endpoint. Query strings arrive as text, hence coerce. */
export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export class PageQueryDto extends createZodDto(PageQuerySchema) {}
