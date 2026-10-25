import { createZodDto } from '../../common/zod/zod-dto.js';
import { UpdateNoteSchema } from '../note.schema.js';

export class UpdateNoteDto extends createZodDto(UpdateNoteSchema) {}
