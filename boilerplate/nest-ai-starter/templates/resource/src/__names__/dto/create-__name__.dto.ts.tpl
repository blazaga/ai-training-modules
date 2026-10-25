import { createZodDto } from '../../common/zod/zod-dto.js';
import { Create__Name__Schema } from '../__name__.schema.js';

export class Create__Name__Dto extends createZodDto(Create__Name__Schema) {}
