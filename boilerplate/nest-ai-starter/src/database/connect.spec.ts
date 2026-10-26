import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectInMemory, MIGRATIONS_FOLDER } from './connect.js';

/**
 * A migration is verified by the LEDGER (the __drizzle_migrations table), never by
 * drizzle's log: the log reads the same for nine migrations and for zero.
 */
describe('database migrations', () => {
  it('applies every committed migration: ledger rows == journal entries', async () => {
    const journal = JSON.parse(
      readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: unknown[] };
    const connection = await connectInMemory();
    try {
      const [{ n }] = await connection.db.all<{ n: number }>(
        sql`select count(*) as n from __drizzle_migrations`,
      );
      expect(journal.entries.length).toBeGreaterThan(0);
      expect(n).toBe(journal.entries.length);
    } finally {
      await connection.close();
    }
  });
});
