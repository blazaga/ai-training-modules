import { createZodDto } from 'nestjs-zod';
import { Update__Name__Schema } from '../__name__.schema';

export class Update__Name__Dto extends createZodDto(Update__Name__Schema) {}
