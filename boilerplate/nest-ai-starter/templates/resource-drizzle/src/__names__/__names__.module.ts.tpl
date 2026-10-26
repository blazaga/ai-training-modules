import { Module } from '@nestjs/common';
import { __Names__Controller } from './__names__.controller.js';
import { Drizzle__Names__Repository } from './__names__.drizzle-repository.js';
import { __NAMES___REPOSITORY } from './__names__.repository.js';
import { __Names__Service } from './__names__.service.js';

@Module({
  controllers: [__Names__Controller],
  providers: [
    __Names__Service,
    // SQLite via drizzle (DB is provided globally by DatabaseModule).
    { provide: __NAMES___REPOSITORY, useClass: Drizzle__Names__Repository },
  ],
  exports: [__Names__Service],
})
export class __Names__Module {}
