import { getTableColumns } from 'drizzle-orm';
import { UserSchema } from './user.schema.js';
import { users } from './users.table.js';

/**
 * Drift guard: the zod schema (API contract) and the drizzle table (storage)
 * are written separately, so nothing else stops them disagreeing. A field
 * added to one and forgotten in the other fails here, not in production.
 */
describe('users table vs UserSchema', () => {
  it('declare exactly the same fields', () => {
    const columns = Object.keys(getTableColumns(users)).sort();
    const fields = Object.keys(UserSchema.shape).sort();
    expect(columns).toEqual(fields);
  });
});
