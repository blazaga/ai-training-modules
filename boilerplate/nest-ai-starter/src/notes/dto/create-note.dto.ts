import { createZodDto } from 'nestjs-zod';
import { CreateNoteSchema } from '../note.schema';

export class CreateNoteDto extends createZodDto(CreateNoteSchema) {}
