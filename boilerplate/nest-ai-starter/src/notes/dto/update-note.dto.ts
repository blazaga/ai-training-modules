import { createZodDto } from 'nestjs-zod';
import { UpdateNoteSchema } from '../note.schema';

export class UpdateNoteDto extends createZodDto(UpdateNoteSchema) {}
