import { randomUUID } from 'node:crypto';

export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * The persistence port every resource depends on. Services inject it through a
 * per-resource token (e.g. NOTES_REPOSITORY), never a concrete class, so the
 * storage can change (in-memory → SQLite) without touching the service or its
 * tests.
 */
export interface Repository<T extends Entity> {
  create(data: Omit<T, keyof Entity>): Promise<T>;
  findPage(limit: number, offset: number): Promise<Page<T>>;
  findById(id: string): Promise<T | undefined>;
  update(
    id: string,
    patch: Partial<Omit<T, keyof Entity>>,
  ): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
}

/**
 * Default adapter: process memory, insertion-ordered. Good for the course, unit
 * tests and e2e. Data is lost on restart, so swap it before production.
 */
export class InMemoryRepository<T extends Entity> implements Repository<T> {
  protected readonly rows = new Map<string, T>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  create(data: Omit<T, keyof Entity>): Promise<T> {
    const stamp = this.now().toISOString();
    const row = {
      ...data,
      id: randomUUID(),
      createdAt: stamp,
      updatedAt: stamp,
    } as T;
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  findPage(limit: number, offset: number): Promise<Page<T>> {
    const all = [...this.rows.values()];
    return Promise.resolve({
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    });
  }

  findById(id: string): Promise<T | undefined> {
    return Promise.resolve(this.rows.get(id));
  }

  update(
    id: string,
    patch: Partial<Omit<T, keyof Entity>>,
  ): Promise<T | undefined> {
    const current = this.rows.get(id);
    if (!current) return Promise.resolve(undefined);
    const next = {
      ...current,
      ...patch,
      updatedAt: this.now().toISOString(),
    } as T;
    this.rows.set(id, next);
    return Promise.resolve(next);
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }
}
