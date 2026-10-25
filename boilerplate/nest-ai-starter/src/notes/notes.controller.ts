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
import { NoteResponseSchema } from './note.schema.js';
import { NotesService } from './notes.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import type { Note, NoteResponse } from './entities/note.entity.js';

/** Strip private fields. Every value this controller returns passes through here. */
const toResponse = (entity: Note): NoteResponse =>
  NoteResponseSchema.parse(entity);

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
  async create(@Body() body: CreateNoteDto): Promise<NoteResponse> {
    return toResponse(await this.service.create(body));
  }

  @Get()
  async findPage(@Query() query: PageQueryDto): Promise<Page<NoteResponse>> {
    const page = await this.service.findPage(query.limit, query.offset);
    return { ...page, items: page.items.map(toResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<NoteResponse> {
    return toResponse(await this.service.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateNoteDto,
  ): Promise<NoteResponse> {
    return toResponse(await this.service.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
