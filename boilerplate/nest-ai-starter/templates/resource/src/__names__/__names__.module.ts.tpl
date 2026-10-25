import { Module } from '@nestjs/common';
import { InMemoryRepository } from '../common/persistence/repository.js';
import { __Names__Controller } from './__names__.controller.js';
import { __NAMES___REPOSITORY } from './__names__.repository.js';
import { __Names__Service } from './__names__.service.js';
import type { __Name__ } from './entities/__name__.entity.js';

@Module({
  controllers: [__Names__Controller],
  providers: [
    __Names__Service,
    // Swap the storage here only; the service and its tests do not change.
    {
      provide: __NAMES___REPOSITORY,
      useFactory: () => new InMemoryRepository<__Name__>(),
    },
  ],
})
export class __Names__Module {}
