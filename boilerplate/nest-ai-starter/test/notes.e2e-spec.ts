import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { NoteResponseSchema } from '../src/notes/note.schema.js';

/** Through the real HTTP stack: routing, validation pipe, error filter. */
describe('notes (e2e)', () => {
  let app: INestApplication<App>;
  const base = '/api/v1/notes';
  const missing = '00000000-0000-4000-8000-000000000000';

  const valid = () => ({ title: 'First note', body: 'Hello' });

  /** Shorthand for requests through the real HTTP server. */
  const http = {
    get: (url: string) => request(app.getHttpServer()).get(url),
    post: (url: string) => request(app.getHttpServer()).post(url),
    patch: (url: string) => request(app.getHttpServer()).patch(url),
    delete: (url: string) => request(app.getHttpServer()).delete(url),
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
    const publicKeys = new Set(Object.keys(NoteResponseSchema.shape));
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

  it('POST applies schema defaults over HTTP', async () => {
    const created = await http
      .post(base)
      .send({ title: 'Defaults only' })
      .expect(201);
    expect(created.body).toMatchObject({ body: '', status: 'draft', tags: [] });
  });

  it('R1: duplicate tags are 400', () =>
    http
      .post(base)
      .send({ ...valid(), tags: ['a', 'a'] })
      .expect(400));

  it('R2: creating published with an empty body is 400', () =>
    http.post(base).send({ title: 'x', status: 'published' }).expect(400));

  it('R3: changing a published title is 422 RULE_VIOLATION', async () => {
    const created = await http
      .post(base)
      .send({ ...valid(), status: 'published' })
      .expect(201);
    await http
      .patch(`${base}/${created.body.id}`)
      .send({ title: 'Renamed' })
      .expect(422)
      .expect((res) => expect(res.body.code).toBe('RULE_VIOLATION'));
  });

  it('PATCH {title} on a draft keeps body and tags (no defaults applied)', async () => {
    const created = await http
      .post(base)
      .send({ ...valid(), tags: ['keep'] })
      .expect(201);
    await http
      .patch(`${base}/${created.body.id}`)
      .send({ title: 'Renamed' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ body: 'Hello', tags: ['keep'] }),
      );
  });
});
