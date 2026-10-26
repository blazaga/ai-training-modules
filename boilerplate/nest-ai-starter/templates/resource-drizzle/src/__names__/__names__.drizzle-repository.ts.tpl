import { Inject, Injectable } from '@nestjs/common';
import { DrizzleRepository } from '../common/persistence/drizzle-repository.js';
import { DB, type Db } from '../database/database.types.js';
import type { __Names__Repository } from './__names__.repository.js';
import { __namesCamel__ } from './__names__.table.js';
import type { __Name__ } from './entities/__name__.entity.js';

/** SQLite storage for __names__ (drizzle). CRUD comes from DrizzleRepository. */
@Injectable()
export class Drizzle__Names__Repository
  extends DrizzleRepository<__Name__>
  implements __Names__Repository
{
  constructor(@Inject(DB) db: Db) {
    super(db, __namesCamel__, '__Name__');
  }

  // AI-FILL(queries-impl): implement each extra lookup declared in
  // __names__.repository.ts with drizzle (this.db.select().from(__namesCamel__)
  // .where(eq(__namesCamel__.column, value)).limit(1)), returning rows through
  // this.toEntity(row). If none, delete this comment.
}
