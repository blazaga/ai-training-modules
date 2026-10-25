import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectPglite, MIGRATIONS_FOLDER } from './connect.js';

/**
 * A migration is verified by the LEDGER (drizzle.__drizzle_migrations), never by
 * drizzle's log: the log reads the same for nine migrations and for zero.
 */
describe('database migrations', () => {
  it('applies every committed migration: ledger rows == journal entries', async () => {
    const journal = JSON.parse(
      readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: unknown[] };
    const connection = await connectPglite();
    try {
      const result = (await connection.db.execute(
        sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
      )) as unknown as { rows: { n: number }[] };
      expect(journal.entries.length).toBeGreaterThan(0);
      expect(result.rows[0].n).toBe(journal.entries.length);
    } finally {
      await connection.close();
    }
  });
});
