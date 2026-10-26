import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleRepository } from '../common/persistence/drizzle-repository.js';
import { DB, type Db } from '../database/database.types.js';
import type { UsersRepository } from './users.repository.js';
import { users } from './users.table.js';
import type { User } from './entities/user.entity.js';

/** SQLite storage for users (drizzle). CRUD comes from DrizzleRepository. */
@Injectable()
export class DrizzleUsersRepository
  extends DrizzleRepository<User>
  implements UsersRepository
{
  constructor(@Inject(DB) db: Db) {
    super(db, users, 'User');
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ? this.toEntity(row) : undefined;
  }
}
