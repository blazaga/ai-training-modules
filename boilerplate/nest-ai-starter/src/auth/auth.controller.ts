import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { UserResponse } from '../users/entities/user.entity.js';

/** Routes: /api/v1/auth */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /** Who am I? Only reachable once authentication has set `req.user`. */
  @Get('me')
  me(@Req() req: Request & { user: UserResponse }): UserResponse {
    return req.user;
  }
}
