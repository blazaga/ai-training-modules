import { basic, type LabApp, signUp, startApp } from './lab-harness.js';

/**
 * Lab 03 (module 3): the rule "every authentication failure is the same 401".
 *
 * Red on the base, green once module 3 has built login and the JWT guard (specs/auth.md).
 * Then the lab is to break the rule on purpose (give unknown emails a different message at
 * login), watch this check AND `pnpm test:e2e` fail, then put it back and watch both pass.
 */
describe('Lab 03 · one identical 401 for every auth failure', () => {
  let lab: LabApp;
  let email: string;
  let token: string;
  const loginUrl = '/api/v1/auth/login';
  const me = '/api/v1/auth/me';
  const SAME = {
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Invalid credentials',
  };

  beforeAll(async () => {
    lab = await startApp();
    const user = await signUp(lab, 'lab03@example.com', 'the right passphrase');
    email = user.email;
    token = user.auth;
  });
  afterAll(() => lab?.close());

  const loginFailures: [string, Record<string, string>][] = [
    ['no Authorization header', {}],
    [
      'a wrong password',
      { Authorization: basic('lab03@example.com', 'a wrong passphrase') },
    ],
    [
      'an unknown email',
      { Authorization: basic('nobody@example.com', 'the right passphrase') },
    ],
    ['malformed base64', { Authorization: 'Basic %%%' }],
  ];

  it.each(loginFailures)(
    'login with %s → 401 with the SAME body and a Basic challenge',
    async (_label, headers) => {
      const res = await lab.rest().post(loginUrl).set(headers);
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

  const tokenFailures: [string, Record<string, string>][] = [
    ['no Authorization header', {}],
    [
      'Basic instead of a token',
      { Authorization: basic('lab03@example.com', 'x') },
    ],
    ['a token that is not a JWT', { Authorization: 'Bearer abc.def.ghi' }],
  ];

  it.each(tokenFailures)(
    '/me with %s → 401 with the SAME body and a Bearer challenge',
    async (_label, headers) => {
      const res = await lab.rest().get(me).set(headers);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(SAME);
      expect(res.headers['www-authenticate']).toMatch(
        /^Bearer realm="nest-ai-starter"/,
      );
    },
  );

  it('the right credentials → a token, and the token → the public user (no password, no hash)', async () => {
    const login = await lab
      .rest()
      .post(loginUrl)
      .set('Authorization', basic(email, 'the right passphrase'))
      .expect(200);
    expect(login.body.tokenType).toBe('Bearer');
    const res = await lab
      .rest()
      .get(me)
      .set('Authorization', token)
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});
