import type { Repository } from '../common/persistence/repository';
import type { __Name__ } from './entities/__name__.entity';

/** Injection token: services depend on the port, never on a storage class. */
export const __NAMES___REPOSITORY = Symbol('__NAMES___REPOSITORY');

export type __Names__Repository = Repository<__Name__>;
