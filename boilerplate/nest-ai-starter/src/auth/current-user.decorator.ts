import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserResponse } from '../users/entities/user.entity.js';

/**
 * The authenticated (public) user that BasicAuthGuard put on the request.
 * Use only on routes that are NOT @Public(), where it is always set.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserResponse =>
    context.switchToHttp().getRequest<{ user: UserResponse }>().user,
);
