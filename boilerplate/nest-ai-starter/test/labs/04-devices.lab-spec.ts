import { type LabApp, signUp, startApp } from './lab-harness.js';

/**
 * Lab 04 (module 3): devices, provisioned with a key and a secret (specs/devices.md).
 *
 * The contract (HTTP only; the MCP headers come in module 6):
 *   POST   /api/v1/devices/provision  { name }  → 201 an ACTIVE device with deviceKey (DK + 16
 *          chars A-Z2-7) and a one-time `secret` (dsk_…); secretLast4 = its last 4 characters
 *   GET    /api/v1/devices/:id         the device, never `secret` or `secretHash`
 *   GET    /api/v1/devices             only the caller's devices
 *   POST   /api/v1/devices/:id/rotate  → 200 the same deviceKey, a new secret
 *   DELETE /api/v1/devices/:id         → 204, the device stays with status `archived`;
 *          rotating it afterwards → 422
 *   another user's device → 404 (never 403); no token → 401
 */
describe('Lab 04 · devices: provision, rotate, archive', () => {
  let lab: LabApp;
  let auth: string;
  let otherAuth: string;
  const base = '/api/v1/devices';

  beforeAll(async () => {
    lab = await startApp();
    auth = (await signUp(lab, 'lab04-devices@example.com')).auth;
    otherAuth = (await signUp(lab, 'lab04-other@example.com')).auth;
  });
  afterAll(() => lab?.close());

  const provision = (as = auth) =>
    lab
      .rest()
      .post(`${base}/provision`)
      .set('Authorization', as)
      .send({ name: 'lab device' });

  it('needs a token (401 without one)', async () => {
    await lab.rest().post(`${base}/provision`).send({ name: 'x' }).expect(401);
  });

  it('provision → 201: active, with a device key and a one-time secret', async () => {
    const res = await provision();
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.deviceKey).toMatch(/^DK[A-Z2-7]{16}$/);
    expect(res.body.secret).toMatch(/^dsk_[A-Za-z0-9_-]{43}$/);
    expect(res.body.secretLast4).toBe(res.body.secret.slice(-4));
    expect(res.body).not.toHaveProperty('secretHash');
  });

  it('GET never shows the secret or its hash', async () => {
    const { body: device } = await provision().expect(201);
    const got = await lab
      .rest()
      .get(`${base}/${device.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(got.body.deviceKey).toBe(device.deviceKey);
    expect(got.body).not.toHaveProperty('secret');
    expect(got.body).not.toHaveProperty('secretHash');
  });

  it('rotate → 200: the same key, a new secret', async () => {
    const { body: device } = await provision().expect(201);
    const rotated = await lab
      .rest()
      .post(`${base}/${device.id}/rotate`)
      .set('Authorization', auth)
      .expect(200);
    expect(rotated.body.deviceKey).toBe(device.deviceKey);
    expect(rotated.body.secret).toMatch(/^dsk_/);
    expect(rotated.body.secret).not.toBe(device.secret);
  });

  it('DELETE archives: 204, the device stays archived, and rotating it is 422', async () => {
    const { body: device } = await provision().expect(201);
    await lab
      .rest()
      .delete(`${base}/${device.id}`)
      .set('Authorization', auth)
      .expect(204);
    const got = await lab
      .rest()
      .get(`${base}/${device.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(got.body.status).toBe('archived');
    await lab
      .rest()
      .post(`${base}/${device.id}/rotate`)
      .set('Authorization', auth)
      .expect(422);
  });

  it("another user's device is 404, and the list holds only your own", async () => {
    const { body: device } = await provision().expect(201);
    await lab
      .rest()
      .get(`${base}/${device.id}`)
      .set('Authorization', otherAuth)
      .expect(404);
    await lab
      .rest()
      .post(`${base}/${device.id}/rotate`)
      .set('Authorization', otherAuth)
      .expect(404);
    const theirs = await lab
      .rest()
      .get(base)
      .set('Authorization', otherAuth)
      .expect(200);
    expect(theirs.body.items.map((d: { id: string }) => d.id)).not.toContain(
      device.id,
    );
  });
});
