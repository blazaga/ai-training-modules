import { asc, count, eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Db } from '../../database/database.types.js';
import { ConflictError } from '../errors/domain-error.js';
import type { Entity, Page, Repository } from './repository.js';

/** A table that has the three columns every entity has. */
export type EntityTable = SQLiteTable & {
  id: SQLiteColumn;
  createdAt: SQLiteColumn;
  updatedAt: SQLiteColumn;
};

/** The driver error (libSQL), found on the error drizzle throws or on its cause chain. */
function sqliteError(
  error: unknown,
): { extendedCode?: string; code?: string; message?: string } | undefined {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (typeof (e as { code?: unknown }).code === 'string') {
      const code = (e as { code: string }).code;
      if (code.startsWith('SQLITE_')) return e as never;
    }
  }
  return undefined;
}

const isUniqueViolation = (error: unknown) =>
  sqliteError(error)?.extendedCode === 'SQLITE_CONSTRAINT_UNIQUE';

/**
 * A delete blocked by a foreign key reports a DIFFERENT code depending on how the key was
 * declared (measured, libSQL 0.18 / SQLite 3.45): ON DELETE RESTRICT →
 * SQLITE_CONSTRAINT_TRIGGER (1811); NO ACTION (the default) → SQLITE_CONSTRAINT_FOREIGNKEY
 * (787). Both say "FOREIGN KEY constraint failed". TRIGGER is also what a user-defined
 * trigger's RAISE() reports, so that one is matched together with the message. Handle both,
 * or one kind surfaces as a 500.
 */
function isBlockedByForeignKey(error: unknown): boolean {
  const e = sqliteError(error);
  return (
    e?.extendedCode === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
    (e?.extendedCode === 'SQLITE_CONSTRAINT_TRIGGER' &&
      /FOREIGN KEY constraint failed/.test(e.message ?? ''))
  );
}

/**
 * Timestamps are stored as ISO strings (src/database/columns.ts), which is also the API
 * contract, so rows and entities need no conversion.
 */
const toEntity = <T>(row: Record<string, unknown>): T => row as T;

/**
 * The Repository port backed by SQLite via drizzle. Services and their unit
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
        .values(data as never)
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
        .set({ ...patch, updatedAt: new Date().toISOString() } as never)
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
    try {
      const rows = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id))
        .returning({ id: this.table.id });
      return rows.length > 0;
    } catch (error) {
      // Another row still references this one (e.g. a user who owns devices).
      if (isBlockedByForeignKey(error)) {
        throw new ConflictError(
          `${this.entityName} is still referenced and cannot be deleted`,
        );
      }
      throw error;
    }
  }
}
