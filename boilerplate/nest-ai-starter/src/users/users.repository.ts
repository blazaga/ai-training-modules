import type { Repository } from '../common/persistence/repository.js';
import type { User } from './entities/user.entity.js';

/** Injection token: services depend on the port, never on a storage class. */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

/** The generic CRUD port plus the lookups this resource needs. */
export interface UsersRepository extends Repository<User> {
  /** Exact match on the stored (lower-cased) email. */
  findByEmail(email: string): Promise<User | undefined>;
}
