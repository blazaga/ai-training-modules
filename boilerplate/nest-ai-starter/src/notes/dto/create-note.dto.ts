import { createZodDto } from '../../common/zod/zod-dto.js';
import { CreateNoteSchema } from '../note.schema.js';

export class CreateNoteDto extends createZodDto(CreateNoteSchema) {}
