import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { McpToolsModule } from './mcp/mcp-tools.module.js';
import { NotesModule } from './notes/notes.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DevicesModule } from './devices/devices.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests never read .env: its DATABASE_URL would point them at data/app.db, the file the
      // running app uses (measured: SQLITE_BUSY and 409s on the e2e sign-ups). Without it they
      // get an in-memory database. The vitest configs pin NODE_ENV=test.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    DatabaseModule,
    HealthModule,
    McpToolsModule, // ch08: MCP tool controllers, served at /mcp
    // Feature modules. `nest g resource <name>` appends new ones here.
    NotesModule,
    UsersModule,
    AuthModule,
    DevicesModule,
  ],
  providers: [
    // Every @Body/@Query/@Param typed with a createZodDto class is validated.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
