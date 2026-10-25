import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` diffs src/database/schema.ts against drizzle/ and writes a
// new migration. Commit the WHOLE drizzle/ folder (SQL + meta/), or the
// journal and the files disagree.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
});
