import {
  device,
  deviceHeaders,
  type LabApp,
  rawMcp,
  signUp,
  startApp,
} from './lab-harness.js';

/**
 * Lab 12 (module 6, stretch): device secrets that expire.
 *
 * The contract:
 *   POST /api/v1/devices/provision and POST /api/v1/devices/:id/rotate accept an optional
 *   "expiresAt": "<ISO datetime>" in the body
 *     - expiresAt must be in the future, else 400
 *     - the response carries expiresAt (null when not given); rotating without it clears it
 *   GET /api/v1/devices/:id  shows expiresAt (never the secret)
 *   verifyDeviceKey refuses an expired secret: /mcp answers 401, like any other auth failure
 */
describe('Lab 12 · device secrets with expiresAt', () => {
  let lab: LabApp;
  let auth: string;
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
  const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    lab = await startApp();
    auth = (await signUp(lab, 'lab04@example.com')).auth;
  });
  afterAll(async () => {
    vi.useRealTimers();
    await lab?.close();
  });

  const provision = (body: Record<string, unknown> = {}) =>
    lab
      .rest()
      .post('/api/v1/devices/provision')
      .set('Authorization', auth)
      .send({ name: 'expiring', ...body });
  const rotate = (id: string, body?: Record<string, unknown>) =>
    lab
      .rest()
      .post(`/api/v1/devices/${id}/rotate`)
      .set('Authorization', auth)
      .send(body ?? {});

  it('provisioning with a future expiresAt returns it with the one-time secret', async () => {
    const at = inOneHour();
    const res = await provision({ expiresAt: at });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.secret).toMatch(/^dsk_/);
    expect(
      Date.parse(res.body.expiresAt),
      'expiresAt in the /provision response',
    ).toBe(Date.parse(at));
  });

  it('provisioning without expiresAt gives expiresAt null', async () => {
    const res = await provision();
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeNull();
  });

  it.each([new Date(Date.now() - 60_000).toISOString(), 'tomorrow', 42])(
    'expiresAt %j is rejected (400)',
    async (expiresAt) => {
      await provision({ expiresAt }).expect(400);
    },
  );

  it('GET device shows expiresAt, and rotating without it clears it', async () => {
    const at = inOneHour();
    const created = await provision({ expiresAt: at }).expect(201);
    const id = created.body.id as string;
    const got = await lab
      .rest()
      .get(`/api/v1/devices/${id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(Date.parse(got.body.expiresAt)).toBe(Date.parse(at));
    expect(got.body).not.toHaveProperty('secret');
    expect(got.body).not.toHaveProperty('secretHash');
    await rotate(id).expect(200);
    const cleared = await lab
      .rest()
      .get(`/api/v1/devices/${id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(cleared.body.expiresAt).toBeNull();
  });

  it('an expired secret is refused by /mcp (401); before expiry it works', async () => {
    const creds = await device(lab, auth, 'active', { expiresAt: inOneHour() });
    await rawMcp(lab, ping, deviceHeaders(creds)).expect(200);
    // Two hours later. Only Date is faked: the HTTP server's timers keep running.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    try {
      const res = await rawMcp(lab, ping, deviceHeaders(creds));
      expect(
        res.status,
        'the expiry check belongs in DevicesService.verifyDeviceKey',
      ).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a secret without expiresAt keeps working (no accidental expiry)', async () => {
    const creds = await device(lab, auth, 'active');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000);
    try {
      await rawMcp(lab, ping, deviceHeaders(creds)).expect(200);
    } finally {
      vi.useRealTimers();
    }
  });
});
