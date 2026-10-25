import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module.js';
import { UsersModule } from '../users/users.module.js';
import { IdentityTools } from './identity.tools.js';
import { NotesTools } from './notes.tools.js';

/** Every @McpController lives here, so each entrypoint (stdio, HTTP) serves the same tools. */
@Module({
  imports: [NotesModule, UsersModule],
  controllers: [NotesTools, IdentityTools],
})
export class McpToolsModule {}

/** The server identity clients see in `initialize`. */
export const MCP_SERVER_INFO = { name: 'nest-ai-starter', version: '0.1.0' };
