import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter.js';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { NotesModule } from './notes/notes.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    HealthModule,
    // Feature modules. `nest g resource <name>` appends new ones here.
    NotesModule,
    UsersModule,
  ],
  providers: [
    // Every @Body/@Query/@Param typed with a createZodDto class is validated.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
