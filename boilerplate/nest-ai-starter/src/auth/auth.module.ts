import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { BasicAuthGuard } from './basic-auth.guard.js';
import { BasicStrategy } from './basic.strategy.js';

/**
 * Step 2: Passport replaces the step-1 middleware. Registering the guard as
 * APP_GUARD makes EVERY route authenticated; opt out with @Public(). Compare
 * step 1, where each route had to be remembered in configure().
 */
@Module({
  imports: [UsersModule, PassportModule],
  controllers: [AuthController],
  providers: [BasicStrategy, { provide: APP_GUARD, useClass: BasicAuthGuard }],
})
export class AuthModule {}
