import { createZodDto } from 'nestjs-zod';
import { Create__Name__Schema } from '../__name__.schema';

export class Create__Name__Dto extends createZodDto(Create__Name__Schema) {}
