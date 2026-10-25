import { getTableColumns } from 'drizzle-orm';
import { __Name__Schema } from './__name__.schema.js';
import { __namesCamel__ } from './__names__.table.js';

/**
 * Drift guard: the zod schema (API contract) and the drizzle table (storage)
 * are written separately, so nothing else stops them disagreeing. A field
 * added to one and forgotten in the other fails here, not in production.
 */
describe('__names__ table vs __Name__Schema', () => {
  it('declare exactly the same fields', () => {
    const columns = Object.keys(getTableColumns(__namesCamel__)).sort();
    const fields = Object.keys(__Name__Schema.shape).sort();
    expect(columns).toEqual(fields);
  });
});
