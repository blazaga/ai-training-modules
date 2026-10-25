import { getTableColumns } from 'drizzle-orm';
import { DeviceSchema } from './device.schema.js';
import { devices } from './devices.table.js';

/**
 * Drift guard: the zod schema (API contract) and the drizzle table (storage)
 * are written separately, so nothing else stops them disagreeing. A field
 * added to one and forgotten in the other fails here, not in production.
 */
describe('devices table vs DeviceSchema', () => {
  it('declare exactly the same fields', () => {
    const columns = Object.keys(getTableColumns(devices)).sort();
    const fields = Object.keys(DeviceSchema.shape).sort();
    expect(columns).toEqual(fields);
  });
});
