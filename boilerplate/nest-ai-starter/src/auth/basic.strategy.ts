import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';
import type { UserResponse } from '../users/entities/user.entity.js';
import { UserResponseSchema } from '../users/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { parseBasicAuth } from './basic-credentials.js';

/**
 * ch03 step 2: HTTP Basic as a Passport strategy named 'basic'.
 *
 * Why passport-custom + our own parser instead of passport-http's BasicStrategy
 * (measured on passport-http 0.3.0): it keeps only the text between the first
 * and SECOND colon, so the password `correct horse: battery` arrives as
 * `correct horse` and can never log in; it answers 400 (not 401) for a
 * malformed header; and it uses the deprecated `new Buffer()`.
 * parseBasicAuth splits at the first colon only, as RFC 7617 says.
 */
@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy, 'basic') {
  constructor(private readonly users: UsersService) {
    super();
  }

  /** Returns the PUBLIC user (→ req.user), or null (→ 401 from BasicAuthGuard). */
  async validate(req: Request): Promise<UserResponse | null> {
    const credentials = parseBasicAuth(req.headers.authorization);
    if (!credentials) return null;
    const user = await this.users.verifyCredentials(
      credentials.email,
      credentials.password,
    );
    return user ? UserResponseSchema.parse(user) : null;
  }
}
