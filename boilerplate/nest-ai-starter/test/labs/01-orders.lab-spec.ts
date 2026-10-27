import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hasAuth, type LabApp, signUp, startApp } from './lab-harness.js';

/**
 * Lab 01 (module 1): an `orders` resource built the house way:
 * spec → nest g resource → template → fill the AI-FILL markers → verify.
 *
 * The contract (write it into specs/orders.md first):
 *   item      string, 1-200 characters, required
 *   quantity  whole number 1-100, default 1          rule O1 (payload only)  → 400
 *   status    'open' | 'fulfilled', default 'open'
 *   O2: once an order is `fulfilled`, its quantity cannot change (needs stored state) → 422
 */
describe('Lab 01 · orders resource', () => {
  let lab: LabApp;
  let auth: string;
  const base = '/api/v1/orders';
  const missing = '00000000-0000-4000-8000-000000000000';
  const http = {
    get: (url: string) => lab.rest().get(url).set('Authorization', auth),
    post: (url: string) => lab.rest().post(url).set('Authorization', auth),
    patch: (url: string) => lab.rest().patch(url).set('Authorization', auth),
    delete: (url: string) => lab.rest().delete(url).set('Authorization', auth),
  };
  const create = async (body: Record<string, unknown>) => {
    const res = await http.post(base).send(body);
    expect(
      res.status,
      `POST ${base} ${JSON.stringify(body)} → ${JSON.stringify(res.body)}`,
    ).toBe(201);
    return res.body;
  };

  beforeAll(async () => {
    lab = await startApp();
    auth = (await signUp(lab, 'lab01@example.com')).auth;
  });
  afterAll(() => lab?.close());

  it('the orders routes exist (not 404); once the app has auth, they need credentials (401)', async () => {
    const res = await lab.rest().get(base);
    expect(
      res.status,
      'a 404 here means OrdersModule is not registered (did `nest g resource orders` run?)',
    ).toBe((await hasAuth(lab)) ? 401 : 200);
  });

  it('POST creates an order with the defaults: quantity 1, status open', async () => {
    const order = await create({ item: 'Pencil' });
    expect(order).toMatchObject({
      item: 'Pencil',
      quantity: 1,
      status: 'open',
    });
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(order.createdAt).toBeTruthy();
    expect(order.updatedAt).toBeTruthy();
  });

  it.each([0, 101, 1.5, '2'])(
    'O1: quantity %j is rejected (400)',
    async (quantity) => {
      await http.post(base).send({ item: 'Pen', quantity }).expect(400);
    },
  );

  it.each([{}, { item: '' }, { item: 'x'.repeat(201) }])(
    'item is required, 1-200 characters: %j → 400',
    async (body) => {
      await http.post(base).send(body).expect(400);
    },
  );

  it('GET lists orders as a page ({ items: [...] })', async () => {
    const order = await create({ item: 'Notebook', quantity: 3 });
    const res = await http.get(base).expect(200);
    expect(
      Array.isArray(res.body.items),
      'the list answers { items, ... } like /api/v1/notes',
    ).toBe(true);
    expect(res.body.items.map((o: { id: string }) => o.id)).toContain(order.id);
  });

  it('GET by id: found 200, unknown id 404, malformed id 400', async () => {
    const order = await create({ item: 'Stapler' });
    await http.get(`${base}/${order.id}`).expect(200);
    await http.get(`${base}/${missing}`).expect(404);
    await http.get(`${base}/not-a-uuid`).expect(400);
  });

  it('PATCH changes the quantity of an open order and keeps the other fields', async () => {
    const order = await create({ item: 'Folder', quantity: 2 });
    const res = await http
      .patch(`${base}/${order.id}`)
      .send({ quantity: 5 })
      .expect(200);
    expect(res.body).toMatchObject({
      item: 'Folder',
      quantity: 5,
      status: 'open',
    });
  });

  it('O2: once fulfilled, the quantity cannot change (422 RULE_VIOLATION)', async () => {
    const order = await create({ item: 'Binder', quantity: 2 });
    await http
      .patch(`${base}/${order.id}`)
      .send({ status: 'fulfilled' })
      .expect(200);
    const res = await http.patch(`${base}/${order.id}`).send({ quantity: 9 });
    expect(
      res.status,
      'a rule that needs stored state lives in the service and throws RuleViolationError',
    ).toBe(422);
    expect(res.body.code).toBe('RULE_VIOLATION');
    const after = await http.get(`${base}/${order.id}`).expect(200);
    expect(
      after.body.quantity,
      'the rejected PATCH must not have been stored',
    ).toBe(2);
  });

  it('DELETE answers 204, and the order is gone (404)', async () => {
    const order = await create({ item: 'Eraser' });
    await http.delete(`${base}/${order.id}`).expect(204);
    await http.get(`${base}/${order.id}`).expect(404);
  });

  it('every AI-FILL marker in src/orders/ is filled', () => {
    const dir = join(process.cwd(), 'src', 'orders');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else files.push(p);
      }
    };
    walk(dir);
    const left = files.filter((f) =>
      readFileSync(f, 'utf8').includes('AI-FILL'),
    );
    expect(left, 'run `pnpm check:ai-fill` for the exact lines').toEqual([]);
  });
});
