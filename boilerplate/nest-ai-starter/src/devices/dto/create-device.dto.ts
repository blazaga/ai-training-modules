import { createZodDto } from '../../common/zod/zod-dto.js';
import { CreateDeviceSchema } from '../device.schema.js';

export class CreateDeviceDto extends createZodDto(CreateDeviceSchema) {}
