import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-error.js';
import type { Entity, Page } from '../common/persistence/repository.js';
import {
  __NAMES___REPOSITORY,
  type __Names__Repository,
} from './__names__.repository.js';
import type { Create__Name__Dto } from './dto/create-__name__.dto.js';
import type { Update__Name__Dto } from './dto/update-__name__.dto.js';
import type { __Name__ } from './entities/__name__.entity.js';

/**
 * Business logic for __names__. Shape rules (types, lengths, enums) live in the
 * schema. Only rules that need state or more than one field belong here, and
 * they fail by throwing a DomainError, never by returning a flag.
 */
@Injectable()
export class __Names__Service {
  constructor(
    @Inject(__NAMES___REPOSITORY) private readonly repo: __Names__Repository,
  ) {}

  async create(input: Create__Name__Dto): Promise<__Name__> {
    // AI-FILL(create-rules): enforce any create-time business rule from the spec
    // (throw ConflictError / RuleViolationError). If the spec has none, delete this
    // comment and write "No create-time rules." in its place.
    return this.repo.create(await this.toStored(input));
  }

  /** The create payload in its STORED shape: write-only inputs become private fields. */
  private toStored(
    input: Create__Name__Dto,
  ): Promise<Omit<__Name__, keyof Entity>> | Omit<__Name__, keyof Entity> {
    // AI-FILL(create-mapping): map write-only inputs to private fields (e.g. hash
    // `password` into `passwordHash`) and give server-owned fields their initial
    // values. If the spec has neither, replace this comment with "No write-only
    // inputs." and keep the line below.
    return input;
  }

  findPage(limit: number, offset: number): Promise<Page<__Name__>> {
    return this.repo.findPage(limit, offset);
  }

  async findOne(id: string): Promise<__Name__> {
    const found = await this.repo.findById(id);
    if (!found) throw new NotFoundError('__Name__', id);
    return found;
  }

  async update(id: string, patch: Update__Name__Dto): Promise<__Name__> {
    const current = await this.findOne(id);
    // AI-FILL(update-rules): enforce update-time business rules comparing `current`
    // with `patch` (e.g. immutable fields, allowed state transitions). If none, delete
    // this comment and write "No update-time rules." in its place.
    void current;
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError('__Name__', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const current = await this.findOne(id);
    // AI-FILL(remove-rules): enforce rules on WHETHER this may be deleted (e.g. only
    // drafts). If none, delete this comment and write "No remove-time rules.".
    void current;
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('__Name__', id);
  }
}
