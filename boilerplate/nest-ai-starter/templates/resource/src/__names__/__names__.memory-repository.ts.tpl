import { InMemoryRepository } from '../common/persistence/repository.js';
import type { __Names__Repository } from './__names__.repository.js';
import type { __Name__ } from './entities/__name__.entity.js';

/** In-memory storage for __names__: used by the module and by unit tests. */
export class InMemory__Names__Repository
  extends InMemoryRepository<__Name__>
  implements __Names__Repository
{
  // AI-FILL(queries-impl): implement each extra lookup declared in
  // __names__.repository.ts over `this.rows`. If none, delete this comment.
}
