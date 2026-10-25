import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { UserResponseSchema } from '../users/user.schema.js';
import { UsersService } from '../users/users.service.js';
import {
  parseBasicAuth,
  UNAUTHORIZED_BODY,
  WWW_AUTHENTICATE,
} from './basic-credentials.js';

/**
 * ch03 step 1: HTTP Basic auth written by hand, to see every moving part
 * before Passport hides them. Applied per route in AuthModule.configure().
 *
 * On success: `req.user` is the PUBLIC user (no password hash).
 * On ANY failure (no header, malformed, unknown email, wrong password,
 * disabled account): the same 401 body and WWW-Authenticate header.
 */
@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  constructor(private readonly users: UsersService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const credentials = parseBasicAuth(req.headers.authorization);
    const user = credentials
      ? await this.users.verifyCredentials(
          credentials.email,
          credentials.password,
        )
      : undefined;

    if (!user) {
      res
        .status(401)
        .setHeader('WWW-Authenticate', WWW_AUTHENTICATE)
        .json(UNAUTHORIZED_BODY);
      return;
    }
    (req as Request & { user: unknown }).user = UserResponseSchema.parse(user);
    next();
  }
}
