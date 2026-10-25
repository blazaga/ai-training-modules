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
import type { Page } from '../common/persistence/repository';
import { PageQueryDto } from '../common/schemas/page-query.schema';
import { __Names__Service } from './__names__.service';
import { Create__Name__Dto } from './dto/create-__name__.dto';
import { Update__Name__Dto } from './dto/update-__name__.dto';
import type { __Name__ } from './entities/__name__.entity';

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
  create(@Body() body: Create__Name__Dto): Promise<__Name__> {
    return this.service.create(body);
  }

  @Get()
  findPage(@Query() query: PageQueryDto): Promise<Page<__Name__>> {
    return this.service.findPage(query.limit, query.offset);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<__Name__> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Update__Name__Dto,
  ): Promise<__Name__> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
