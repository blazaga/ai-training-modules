import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { basic, type LabApp, startApp } from './lab-harness.js';

/**
 * Lab 02 (lite module 2): add `phone` to users, through schema, table and migration.
 *
 * The contract:
 *   phone  optional, E.164: a "+", then 2-15 digits, the first not 0 (e.g. +14155550123)
 *          absent → stored as null; anything else → 400
 */
describe('Lab 02 · users.phone', () => {
  let lab: LabApp;
  const users = '/api/v1/users';
  let n = 0;
  const signUpWith = (extra: Record<string, unknown>) =>
    lab
      .rest()
      .post(users)
      .send({
        email: `lab02-${++n}@example.com`,
        name: 'Phone Lab',
        password: 'lab passphrase 123',
        ...extra,
      });

  beforeAll(async () => {
    lab = await startApp();
  });
  afterAll(() => lab.close());

  it('sign-up stores a valid E.164 phone and returns it', async () => {
    const res = await signUpWith({ phone: '+14155550123' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.phone, 'the response schema must include phone').toBe(
      '+14155550123',
    );
  });

  it('phone is optional: without it the user has phone null', async () => {
    const res = await signUpWith({});
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(
      'phone' in res.body,
      'phone is part of every user response, null when not set',
    ).toBe(true);
    expect(res.body.phone).toBeNull();
  });

  it.each([
    '4155550123',
    'abc',
    '+0123456',
    '+1',
    '+1234567890123456',
    '+1 415 555 0123',
  ])('phone %j is not E.164 → 400', async (phone) => {
    await signUpWith({ phone }).expect(400);
  });

  it('PATCH sets and changes the phone; GET returns it', async () => {
    const email = `lab02-${++n}@example.com`;
    const created = await lab
      .rest()
      .post(users)
      .send({ email, name: 'Phone Lab', password: 'lab passphrase 123' })
      .expect(201);
    const auth = basic(email, 'lab passphrase 123');
    await lab
      .rest()
      .patch(`${users}/${created.body.id}`)
      .set('Authorization', auth)
      .send({ phone: '+639171234567' })
      .expect(200);
    const got = await lab
      .rest()
      .get(`${users}/${created.body.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(got.body.phone).toBe('+639171234567');
  });

  it('a committed migration adds the phone column', () => {
    const dir = join(process.cwd(), 'drizzle');
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    expect(sql, 'run `pnpm db:generate` and commit drizzle/').toMatch(
      /ADD COLUMN\s+"phone"/i,
    );
  });

  it('pnpm check:migrations is clean (the table and the migrations agree)', () => {
    const run = spawnSync(process.execPath, ['scripts/check-migrations.mjs'], {
      encoding: 'utf8',
    });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, 120_000);
});
