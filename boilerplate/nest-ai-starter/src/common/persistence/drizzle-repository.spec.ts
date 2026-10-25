import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { connectPglite, type Connection } from '../../database/connect.js';
import { ConflictError } from '../errors/domain-error.js';
import { DrizzleRepository } from './drizzle-repository.js';
import type { Entity } from './repository.js';

/** A throwaway table, created by hand, to test the generic adapter alone. */
const things = pgTable('things', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  seenAt: timestamp('seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
interface Thing extends Entity {
  name: string;
  seenAt: string | null;
}

describe('DrizzleRepository', () => {
  let connection: Connection;
  let repo: DrizzleRepository<Thing>;

  beforeAll(async () => {
    connection = await connectPglite();
    await connection.db.execute(sql`create table things (
      id uuid primary key default gen_random_uuid(), name text not null unique,
      seen_at timestamptz, created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())`);
    repo = new DrizzleRepository<Thing>(connection.db, things, 'Thing');
  });

  afterAll(async () => {
    await connection.close();
  });

  it('accepts ISO strings for timestamp columns and returns ISO strings', async () => {
    const at = '2026-10-25T12:00:00.000Z';
    const created = await repo.create({ name: 'a', seenAt: at });
    expect(created.seenAt).toBe(at);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    const later = '2026-10-26T08:30:00.000Z';
    await expect(
      repo.update(created.id, { seenAt: later }),
    ).resolves.toMatchObject({ seenAt: later });
  });

  it('maps a unique violation to ConflictError', async () => {
    await repo.create({ name: 'dup', seenAt: null });
    await expect(
      repo.create({ name: 'dup', seenAt: null }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('pages in creation order with a total', async () => {
    const page = await repo.findPage(1, 0);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });
});
