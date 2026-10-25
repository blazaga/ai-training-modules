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
import { NotesService } from './notes.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import type { Note } from './entities/note.entity.js';

/**
 * HTTP only: parse, delegate, return. No business logic here (it goes in the
 * service) and no try/catch (DomainExceptionFilter maps errors).
 * Routes: /api/v1/notes
 */
@ApiTags('notes')
@Controller('notes')
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Post()
  create(@Body() body: CreateNoteDto): Promise<Note> {
    return this.service.create(body);
  }

  @Get()
  findPage(@Query() query: PageQueryDto): Promise<Page<Note>> {
    return this.service.findPage(query.limit, query.offset);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Note> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateNoteDto,
  ): Promise<Note> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
