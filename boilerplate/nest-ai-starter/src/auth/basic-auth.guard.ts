import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { UNAUTHORIZED_BODY, WWW_AUTHENTICATE } from './basic-credentials.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global guard (APP_GUARD in AuthModule): every route needs valid Basic
 * credentials unless it is marked @Public(). Any failure becomes the same 401
 * body plus a WWW-Authenticate challenge, exactly as the step-1 middleware did.
 */
@Injectable()
export class BasicAuthGuard extends AuthGuard('basic') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser>(
    err: unknown,
    user: TUser | false | null,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('WWW-Authenticate', WWW_AUTHENTICATE);
      throw new UnauthorizedException(UNAUTHORIZED_BODY);
    }
    return user;
  }
}
