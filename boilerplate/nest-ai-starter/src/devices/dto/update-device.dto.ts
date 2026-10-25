import { createZodDto } from '../../common/zod/zod-dto.js';
import { UpdateDeviceSchema } from '../device.schema.js';

export class UpdateDeviceDto extends createZodDto(UpdateDeviceSchema) {}
