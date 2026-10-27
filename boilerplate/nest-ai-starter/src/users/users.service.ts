import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-error.js';
import { hashPassword } from '../common/security/password.js';
import type { Entity, Page } from '../common/persistence/repository.js';
import { USERS_REPOSITORY, type UsersRepository } from './users.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { User } from './entities/user.entity.js';

/**
 * Business logic for users. Shape rules (types, lengths, enums) live in the
 * schema. Only rules that need state or more than one field belong here, and
 * they fail by throwing a DomainError, never by returning a flag.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly repo: UsersRepository,
  ) {}

  async create(input: CreateUserDto): Promise<User> {
    // No create-time rules beyond R1, which the unique constraint enforces (409).
    return this.repo.create(await this.toStored(input));
  }

  /** The create payload in its STORED shape: write-only inputs become private fields. */
  private toStored(
    input: CreateUserDto,
  ): Promise<Omit<User, keyof Entity>> | Omit<User, keyof Entity> {
    // Spec R2: the plain password is hashed here and never reaches the repository.
    const { password, ...fields } = input;
    return hashPassword(password).then((passwordHash) => ({
      ...fields,
      passwordHash,
    }));
  }

  findPage(limit: number, offset: number): Promise<Page<User>> {
    return this.repo.findPage(limit, offset);
  }

  async findOne(id: string): Promise<User> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundError('User', id);
    return found;
  }

  async update(id: string, patch: UpdateUserDto): Promise<User> {
    const current = await this.findOne(id);
    // No update-time rules. Password changes are out of scope (spec).
    void current;
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError('User', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const current = await this.findOne(id);
    // No remove-time rules.
    void current;
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('User', id);
  }
}
