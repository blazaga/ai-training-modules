import {
  basic,
  device,
  deviceHeaders,
  type LabApp,
  rawMcp,
  signUp,
  startApp,
} from './lab-harness.js';

/**
 * Lab 09 (lite module 6): MCP auth with device keys, and what rotation does to a live client.
 *
 * This check passes on the starter. It pins the behaviour the lab demonstrates: a rotated
 * secret fails on the very next call, and every device that is not ACTIVE is refused.
 */
describe('Lab 09 · device auth and rotation on /mcp', () => {
  let lab: LabApp;
  let auth: string;
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };

  beforeAll(async () => {
    lab = await startApp();
    auth = (await signUp(lab, 'lab09@example.com')).auth;
  });
  afterAll(() => lab.close());

  it('an active device gets in (200)', async () => {
    const creds = await device(lab, auth, 'active');
    await rawMcp(lab, ping, deviceHeaders(creds)).expect(200);
  });

  it.each(['draft', 'archived'] as const)(
    'a %s device is refused (401)',
    async (state) => {
      const creds = await device(lab, auth, state);
      await rawMcp(lab, ping, deviceHeaders(creds)).expect(401);
    },
  );

  it('missing headers and Basic credentials are refused on /mcp (401)', async () => {
    await rawMcp(lab, ping, {}).expect(401);
    await rawMcp(lab, ping, {
      Authorization: basic('lab09@example.com', 'lab passphrase 123'),
    }).expect(401);
  });

  it('rotation: the old secret fails on the NEXT call, the new one works, same key id', async () => {
    const creds = await device(lab, auth, 'active');
    await rawMcp(lab, ping, deviceHeaders(creds)).expect(200);
    const rotated = await lab
      .rest()
      .post(`/api/v1/devices/${creds.id}/credentials`)
      .set('Authorization', auth)
      .send({})
      .expect(200);
    expect(rotated.body.accessKeyId).toBe(creds.accessKeyId);
    expect(rotated.body.secret).not.toBe(creds.secret);
    await rawMcp(lab, ping, deviceHeaders(creds)).expect(401);
    await rawMcp(
      lab,
      ping,
      deviceHeaders({
        accessKeyId: creds.accessKeyId,
        secret: rotated.body.secret,
      }),
    ).expect(200);
  });
});
