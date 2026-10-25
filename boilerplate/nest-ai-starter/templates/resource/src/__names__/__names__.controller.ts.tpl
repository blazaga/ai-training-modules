import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../common/persistence/repository.js';
import { PageQueryDto } from '../common/schemas/page-query.schema.js';
import { __Name__ResponseSchema } from './__name__.schema.js';
import { __Names__Service } from './__names__.service.js';
import { Create__Name__Dto } from './dto/create-__name__.dto.js';
import { Update__Name__Dto } from './dto/update-__name__.dto.js';
import type {
  __Name__,
  __Name__Response,
} from './entities/__name__.entity.js';

/** Strip private fields. Every value this controller returns passes through here. */
const toResponse = (entity: __Name__): __Name__Response =>
  __Name__ResponseSchema.parse(entity);

/**
 * HTTP only: parse, delegate, return. No business logic here (it goes in the
 * service) and no try/catch (DomainExceptionFilter maps errors).
 * Routes: /api/v1/__names__
 */
@ApiTags('__names__')
@Controller('__names__')
export class __Names__Controller {
  constructor(private readonly service: __Names__Service) {}

  @Post()
  async create(@Body() body: Create__Name__Dto): Promise<__Name__Response> {
    return toResponse(await this.service.create(body));
  }

  @Get()
  async findPage(
    @Query() query: PageQueryDto,
  ): Promise<Page<__Name__Response>> {
    const page = await this.service.findPage(query.limit, query.offset);
    return { ...page, items: page.items.map(toResponse) };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<__Name__Response> {
    return toResponse(await this.service.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Update__Name__Dto,
  ): Promise<__Name__Response> {
    return toResponse(await this.service.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
