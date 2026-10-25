import { createZodDto } from '../../common/zod/zod-dto.js';
import { CreateUserSchema } from '../user.schema.js';

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
