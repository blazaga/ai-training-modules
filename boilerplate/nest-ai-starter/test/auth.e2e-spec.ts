import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

const basic = (email: string, password: string) =>
  `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

/** HTTP Basic auth on GET /api/v1/auth/me, through the real stack. */
describe('auth (e2e)', () => {
  let app: INestApplication<App>;
  const me = '/api/v1/auth/me';
  const ada = {
    email: 'ada@example.com',
    name: 'Ada',
    password: 'correct horse: battery',
  };
  let adaId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send(ada)
      .expect(201);
    adaId = created.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('valid credentials: 200 with the PUBLIC user', async () => {
    const res = await request(app.getHttpServer())
      .get(me)
      .set('Authorization', basic(ada.email, ada.password))
      .expect(200);
    expect(res.body).toMatchObject({ id: adaId, email: ada.email });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('email is matched case-insensitively', () =>
    request(app.getHttpServer())
      .get(me)
      .set('Authorization', basic('ADA@Example.com', ada.password))
      .expect(200));

  it('every failure is the SAME 401, with a WWW-Authenticate challenge', async () => {
    const attempts: [string, string | undefined][] = [
      ['no header', undefined],
      ['wrong scheme', 'Bearer abc'],
      ['malformed', 'Basic !!!not-base64-credentials'],
      ['unknown email', basic('nobody@example.com', ada.password)],
      ['wrong password', basic(ada.email, 'wrong password')],
    ];
    const bodies = new Set<string>();
    for (const [, header] of attempts) {
      const req = request(app.getHttpServer()).get(me);
      if (header) req.set('Authorization', header);
      const res = await req.expect(401);
      expect(res.headers['www-authenticate']).toMatch(/^Basic realm=/);
      bodies.add(JSON.stringify(res.body));
    }
    expect(bodies.size).toBe(1);
  });

  it('a disabled user cannot authenticate (same 401)', async () => {
    const bob = {
      email: 'bob@example.com',
      name: 'Bob',
      password: 'bob horse battery staple',
    };
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send(bob)
      .expect(201);
    await request(app.getHttpServer())
      .get(me)
      .set('Authorization', basic(bob.email, bob.password))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${created.body.id}`)
      .set('Authorization', basic(ada.email, ada.password))
      .send({ status: 'disabled' })
      .expect(200);
    await request(app.getHttpServer())
      .get(me)
      .set('Authorization', basic(bob.email, bob.password))
      .expect(401);
  });
});
