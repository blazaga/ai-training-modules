import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../common/persistence/repository.js';
import { Public } from '../auth/public.decorator.js';
import { PageQueryDto } from '../common/schemas/page-query.schema.js';
import { UserResponseSchema } from './user.schema.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { User, UserResponse } from './entities/user.entity.js';

/** Strip private fields. Every value this controller returns passes through here. */
const toResponse = (entity: User): UserResponse =>
  UserResponseSchema.parse(entity);

/**
 * HTTP only: parse, delegate, return. No business logic here (it goes in the
 * service) and no try/catch (DomainExceptionFilter maps errors).
 * Routes: /api/v1/users
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Public()
  @Post()
  async create(@Body() body: CreateUserDto): Promise<UserResponse> {
    return toResponse(await this.service.create(body));
  }

  @Get()
  async findPage(@Query() query: PageQueryDto): Promise<Page<UserResponse>> {
    const page = await this.service.findPage(query.limit, query.offset);
    return { ...page, items: page.items.map(toResponse) };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponse> {
    return toResponse(await this.service.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserResponse> {
    return toResponse(await this.service.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
