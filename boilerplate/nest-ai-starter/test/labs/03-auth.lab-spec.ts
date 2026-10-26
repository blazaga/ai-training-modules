import { basic, type LabApp, signUp, startApp } from './lab-harness.js';

/**
 * Lab 03 (lite module 3): the rule "every authentication failure is the same 401".
 *
 * This check passes on the starter. The lab is to break the rule on purpose (give unknown
 * emails a different message), watch this check AND `pnpm test:e2e` fail, then put it back
 * and watch both pass again.
 */
describe('Lab 03 · one identical 401 for every auth failure', () => {
  let lab: LabApp;
  let email: string;
  const me = '/api/v1/auth/me';
  const SAME = {
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Invalid credentials',
  };

  beforeAll(async () => {
    lab = await startApp();
    email = (await signUp(lab, 'lab03@example.com', 'the right passphrase'))
      .email;
  });
  afterAll(() => lab.close());

  const failures: [string, Record<string, string>][] = [
    ['no Authorization header', {}],
    [
      'a wrong password',
      { Authorization: basic('lab03@example.com', 'a wrong passphrase') },
    ],
    [
      'an unknown email',
      { Authorization: basic('nobody@example.com', 'the right passphrase') },
    ],
    ['a non-Basic scheme', { Authorization: 'Bearer abc.def.ghi' }],
    ['malformed base64', { Authorization: 'Basic %%%' }],
  ];

  it.each(failures)(
    '%s → 401 with the SAME body and a Basic challenge',
    async (_label, headers) => {
      const res = await lab.rest().get(me).set(headers);
      expect(res.status).toBe(401);
      expect(
        res.body,
        'every failure must be indistinguishable, so emails cannot be probed',
      ).toEqual(SAME);
      expect(res.headers['www-authenticate']).toMatch(
        /^Basic realm="nest-ai-starter"/,
      );
    },
  );

  it('the right credentials → 200 and the public user (no password, no hash)', async () => {
    const res = await lab
      .rest()
      .get(me)
      .set('Authorization', basic(email, 'the right passphrase'))
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});
