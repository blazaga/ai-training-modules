import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { __Name__ResponseSchema } from '../src/__names__/__name__.schema.js';

/** Through the real HTTP stack: routing, validation pipe, error filter. */
describe('__names__ (e2e)', () => {
  let app: INestApplication<App>;
  const base = '/api/v1/__names__';
  const missing = '00000000-0000-4000-8000-000000000000';

  // AI-FILL(valid-input): a factory returning a minimal valid payload. Return a
  // FRESH value per call if any field is unique (e.g. a counter in the email).
  const valid = () => ({});

  /** Shorthand for requests through the real HTTP server. */
  const http = {
    get: (url: string) =>
      request(app.getHttpServer()).get(url),
    post: (url: string) =>
      request(app.getHttpServer()).post(url),
    patch: (url: string) =>
      request(app.getHttpServer()).patch(url),
    delete: (url: string) =>
      request(app.getHttpServer()).delete(url),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST creates (201) and GET reads it back (200)', async () => {
    const created = await http.post(base).send(valid()).expect(201);
    await http
      .get(`${base}/${created.body.id}`)
      .expect(200)
      .expect((res) => expect(res.body).toEqual(created.body));
  });

  it('responses carry only public fields (no private field ever leaves)', async () => {
    const publicKeys = new Set(Object.keys(__Name__ResponseSchema.shape));
    const leaked = (body: object) =>
      Object.keys(body).filter((key) => !publicKeys.has(key));
    const created = await http.post(base).send(valid()).expect(201);
    expect(leaked(created.body)).toEqual([]);
    const list = await http.get(base).expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    for (const item of list.body.items) expect(leaked(item)).toEqual([]);
  });

  it('POST stores the PARSED body: unknown keys are stripped', async () => {
    // Guards the validation pipe's contract over HTTP. A pipe that validated but
    // passed the raw input through would store this key; unit tests cannot see it.
    const created = await http
      .post(base)
      .send({ ...valid(), notAField: 'x' })
      .expect(201);
    expect(created.body).not.toHaveProperty('notAField');
  });

  it('POST rejects an invalid body (400)', () =>
    http.post(base).send({ unexpected: 'shape' }).expect(400));

  it('GET unknown id is 404 with the DomainError body', () =>
    http
      .get(`${base}/${missing}`)
      .expect(404)
      .expect((res) => expect(res.body.code).toBe('NOT_FOUND')));

  it('GET a non-uuid id is 400', () =>
    http.get(`${base}/not-a-uuid`).expect(400));

  it('PATCH with an empty body is 400', async () => {
    const created = await http.post(base).send(valid()).expect(201);
    await http.patch(`${base}/${created.body.id}`).send({}).expect(400);
  });

  it('DELETE is 204, then GET is 404', async () => {
    const created = await http.post(base).send(valid()).expect(201);
    await http.delete(`${base}/${created.body.id}`).expect(204);
    await http.get(`${base}/${created.body.id}`).expect(404);
  });

  // AI-FILL(rule-e2e): one request per business rule proving the HTTP status the rule
  // maps to (409 ConflictError, 422 RuleViolationError). Use `http` (it carries the auth headers once the app has auth).
});
