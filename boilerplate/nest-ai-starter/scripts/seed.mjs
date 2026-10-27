// Rebuild data/app.db: apply every migration in drizzle/, then fill it with generated users,
// notes and shares. `pnpm db:seed`. The repository commits the result, so learners have data
// to work with from the first minute; run this only to start over.
//
// Reproducible on purpose: faker gets a fixed seed and a fixed reference date, and rows are
// inserted in a fixed order, so two runs write the same rows. Change SEED or the counts to get
// a different data set, then commit the new data/app.db.
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { faker } from '@faker-js/faker';

const SEED = 20261027;
const REF_DATE = '2026-10-27T00:00:00.000Z';
const COUNTS = { users: 25, notes: 200, shares: 120 };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data', 'app.db');

mkdirSync(dirname(file), { recursive: true });
for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`])
  if (existsSync(f)) rmSync(f);

const client = createClient({ url: `file:${file}` });
await client.execute('PRAGMA foreign_keys = ON');
await migrate(drizzle(client), { migrationsFolder: join(root, 'drizzle') });

faker.seed(SEED);
faker.setDefaultRefDate(REF_DATE);
const iso = (d) => d.toISOString();
const between = (from, to) => faker.date.between({ from, to });

const users = [];
const emails = new Set();
while (users.length < COUNTS.users) {
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  const email = faker.internet
    .email({ firstName: first, lastName: last, provider: 'example.com' })
    .toLowerCase();
  if (emails.has(email)) continue;
  emails.add(email);
  const createdAt = between(
    '2026-08-01T00:00:00.000Z',
    '2026-09-01T00:00:00.000Z',
  );
  users.push({
    id: faker.string.uuid(),
    email,
    name: `${first} ${last}`,
    createdAt: iso(createdAt),
    updatedAt: iso(between(createdAt, REF_DATE)),
  });
}

const notes = [];
for (let i = 0; i < COUNTS.notes; i++) {
  const owner = faker.helpers.arrayElement(users);
  const createdAt = between(owner.createdAt, REF_DATE);
  const status = faker.helpers.weightedArrayElement([
    { weight: 6, value: 'open' },
    { weight: 4, value: 'done' },
  ]);
  notes.push({
    id: faker.string.uuid(),
    ownerId: owner.id,
    title: faker.lorem.sentence({ min: 2, max: 6 }).replace(/\.$/, ''),
    body:
      faker.helpers.maybe(() => faker.lorem.paragraph(), {
        probability: 0.7,
      }) ?? '',
    status,
    dueAt:
      faker.helpers.maybe(
        () => iso(between(createdAt, '2026-12-31T00:00:00.000Z')),
        { probability: 0.4 },
      ) ?? null,
    createdAt: iso(createdAt),
    updatedAt: iso(between(createdAt, REF_DATE)),
  });
}

const shares = [];
const pairs = new Set();
while (shares.length < COUNTS.shares) {
  const note = faker.helpers.arrayElement(notes);
  const user = faker.helpers.arrayElement(users);
  const key = `${note.id}:${user.id}`;
  if (user.id === note.ownerId || pairs.has(key)) continue; // never shared with its owner
  pairs.add(key);
  shares.push({
    noteId: note.id,
    userId: user.id,
    createdAt: iso(between(note.createdAt, REF_DATE)),
  });
}

await client.batch(
  [
    ...users.map((u) => ({
      sql: 'insert into users (id, email, name, created_at, updated_at) values (?, ?, ?, ?, ?)',
      args: [u.id, u.email, u.name, u.createdAt, u.updatedAt],
    })),
    ...notes.map((n) => ({
      sql: 'insert into notes (id, owner_id, title, body, status, due_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        n.id,
        n.ownerId,
        n.title,
        n.body,
        n.status,
        n.dueAt,
        n.createdAt,
        n.updatedAt,
      ],
    })),
    ...shares.map((s) => ({
      sql: 'insert into note_shares (note_id, user_id, created_at) values (?, ?, ?)',
      args: [s.noteId, s.userId, s.createdAt],
    })),
  ],
  'write',
);

const count = async (t) =>
  (await client.execute(`select count(*) as n from ${t}`)).rows[0].n;
console.log(
  `db:seed: ${file.slice(root.length + 1)}: users ${await count('users')}, notes ${await count('notes')}, note_shares ${await count('note_shares')}`,
);
client.close();
