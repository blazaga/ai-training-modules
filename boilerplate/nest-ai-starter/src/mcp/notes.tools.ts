import { Payload } from '@nestjs/microservices';
import { McpController, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { CreateNoteSchema } from '../notes/note.schema.js';
import { NotesService } from '../notes/notes.service.js';
import { runTool, type ToolResult } from './tool-result.js';

/**
 * ch06: the first MCP controller. Tools are thin adapters over the SAME
 * service the REST controller uses, and `create-note` takes the SAME zod
 * schema as POST /api/v1/notes, so REST and MCP cannot drift apart.
 */
@McpController()
export class NotesTools {
  constructor(private readonly notes: NotesService) {}

  @Tool({
    name: 'list-notes',
    description: 'List notes in creation order. Returns { items, total }.',
    parameters: z.object({
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    }),
  })
  listNotes(
    @Payload() { limit, offset }: { limit: number; offset: number },
  ): Promise<ToolResult> {
    return runTool(() => this.notes.findPage(limit, offset));
  }

  @Tool({
    name: 'get-note',
    description: 'Get one note by its id (a UUID).',
    parameters: z.object({ id: z.string().uuid() }),
  })
  getNote(@Payload() { id }: { id: string }): Promise<ToolResult> {
    return runTool(() => this.notes.findOne(id));
  }

  @Tool({
    name: 'create-note',
    description:
      'Create a note. status is draft or published; a published note needs a body.',
    parameters: CreateNoteSchema,
  })
  createNote(
    @Payload() input: z.output<typeof CreateNoteSchema>,
  ): Promise<ToolResult> {
    return runTool(() => this.notes.create(input));
  }
}
