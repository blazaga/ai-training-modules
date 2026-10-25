import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { BasicAuthMiddleware } from './basic-auth.middleware.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Middleware is attached to routes here, not on the controller. Easy to
    // forget a route, which is one reason step 2 moves to a guard.
    consumer.apply(BasicAuthMiddleware).forRoutes(AuthController);
  }
}
