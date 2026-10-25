import type { Repository } from '../common/persistence/repository.js';
import type { __Name__ } from './entities/__name__.entity.js';

/** Injection token: services depend on the port, never on a storage class. */
export const __NAMES___REPOSITORY = Symbol('__NAMES___REPOSITORY');

/** The generic CRUD port plus the lookups this resource needs. */
export interface __Names__Repository extends Repository<__Name__> {
  // AI-FILL(queries): extra lookups the spec needs, e.g.
  // `findByEmail(email: string): Promise<__Name__ | undefined>;`.
  // Every storage adapter must implement them. If none, delete this comment.
}
