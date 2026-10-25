import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    HealthModule,
    // Feature modules. `nest g resource <name>` appends new ones here.
    NotesModule,
  ],
  providers: [
    // Every @Body/@Query/@Param typed with a createZodDto class is validated.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
