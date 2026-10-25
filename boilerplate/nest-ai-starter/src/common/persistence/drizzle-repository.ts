import { asc, count, eq, getTableColumns } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../../database/database.types.js';
import { ConflictError } from '../errors/domain-error.js';
import type { Entity, Page, Repository } from './repository.js';

/** A table that has the three columns every entity has. */
export type EntityTable = PgTable & {
  id: PgColumn;
  createdAt: PgColumn;
  updatedAt: PgColumn;
};

/** Postgres SQLSTATE for unique_violation. PGlite is real Postgres, so it is the same. */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  // drizzle wraps driver errors; the SQLSTATE is on the error or on its cause.
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/** Timestamps come back from Postgres as Date. The API contract is ISO strings. */
function toEntity<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString() : v,
    ]),
  ) as T;
}

/**
 * Entity values → row values. Entities carry timestamps as ISO strings, but
 * drizzle's timestamp columns need Date objects: given a string they throw
 * `value.toISOString is not a function` (measured, drizzle-orm 0.45.4).
 */
function toRow(
  table: EntityTable,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const columns = getTableColumns(table) as Record<
    string,
    { columnType: string }
  >;
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      typeof v === 'string' && columns[k]?.columnType === 'PgTimestamp'
        ? new Date(v)
        : v,
    ]),
  );
}

/**
 * The Repository port backed by Postgres via drizzle. Services and their unit
 * tests do not change when a module swaps InMemoryRepository for this. That is
 * the point of the port. Subclass it per resource to add lookups (findByEmail).
 */
export class DrizzleRepository<T extends Entity> implements Repository<T> {
  constructor(
    protected readonly db: Db,
    protected readonly table: EntityTable,
    /** Name used in ConflictError messages, e.g. 'User'. */
    protected readonly entityName: string,
  ) {}

  /** For subclass lookups: a raw row → entity (Dates become ISO strings). */
  protected toEntity(row: Record<string, unknown>): T {
    return toEntity<T>(row);
  }

  async create(data: Omit<T, keyof Entity>): Promise<T> {
    try {
      const [row] = await this.db
        .insert(this.table)
        .values(toRow(this.table, data) as never)
        .returning();
      return toEntity<T>(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`${this.entityName} already exists`);
      }
      throw error;
    }
  }

  async findPage(limit: number, offset: number): Promise<Page<T>> {
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(this.table)
        .orderBy(asc(this.table.createdAt), asc(this.table.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(this.table),
    ]);
    return {
      items: rows.map((r) => toEntity<T>(r as Record<string, unknown>)),
      total,
      limit,
      offset,
    };
  }

  async findById(id: string): Promise<T | undefined> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return row ? toEntity<T>(row as Record<string, unknown>) : undefined;
  }

  async update(
    id: string,
    patch: Partial<Omit<T, keyof Entity>>,
  ): Promise<T | undefined> {
    try {
      const [row] = await this.db
        .update(this.table)
        .set({ ...toRow(this.table, patch), updatedAt: new Date() } as never)
        .where(eq(this.table.id, id))
        .returning();
      return row ? toEntity<T>(row) : undefined;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`${this.entityName} already exists`);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning({ id: this.table.id });
    return rows.length > 0;
  }
}
