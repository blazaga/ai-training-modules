import { createZodDto } from '../../common/zod/zod-dto.js';
import { UpdateUserSchema } from '../user.schema.js';

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
