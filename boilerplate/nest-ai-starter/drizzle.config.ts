import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` diffs src/database/schema.ts against the committed snapshots in
// drizzle/meta and writes the next migration. It needs no database.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema.ts',
  out: './drizzle',
});
