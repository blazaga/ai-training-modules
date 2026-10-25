import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { DrizzleUsersRepository } from './users.drizzle-repository.js';
import { USERS_REPOSITORY } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    // Postgres via drizzle (DB is provided globally by DatabaseModule).
    { provide: USERS_REPOSITORY, useClass: DrizzleUsersRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
