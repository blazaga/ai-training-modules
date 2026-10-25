import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-error.js';
import { hashPassword, verifyPassword } from '../common/security/password.js';
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
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('User', id);
  }

  // ---- added in ch03 (auth); not part of the resource template ----

  /** A real scrypt hash of a random value, so unknown emails cost the same work. */
  private readonly decoyHash = hashPassword(
    `decoy-${Math.random()}-${Date.now()}`,
  );

  /**
   * The user for these credentials, or undefined. Every failure looks the same to
   * the caller (unknown email, wrong password, disabled account), and an unknown
   * email still runs one scrypt verify, so response time does not reveal which
   * emails exist.
   */
  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<User | undefined> {
    const user = await this.repo.findByEmail(email.trim().toLowerCase());
    const ok = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.decoyHash),
    );
    return user && ok && user.status === 'active' ? user : undefined;
  }
}
