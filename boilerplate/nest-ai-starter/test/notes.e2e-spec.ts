import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

/** Through the real HTTP stack: routing, validation pipe, error filter. */
describe('notes (e2e)', () => {
  let app: INestApplication<App>;
  const base = '/api/v1/notes';
  const missing = '00000000-0000-4000-8000-000000000000';

  const valid = { title: 'First note', body: 'Hello' };

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
    const created = await request(app.getHttpServer())
      .post(base)
      .send(valid)
      .expect(201);
    await request(app.getHttpServer())
      .get(`${base}/${created.body.id}`)
      .expect(200)
      .expect((res) => expect(res.body).toEqual(created.body));
  });

  it('POST rejects an invalid body (400)', () =>
    request(app.getHttpServer())
      .post(base)
      .send({ unexpected: 'shape' })
      .expect(400));

  it('GET unknown id is 404 with the DomainError body', () =>
    request(app.getHttpServer())
      .get(`${base}/${missing}`)
      .expect(404)
      .expect((res) => expect(res.body.code).toBe('NOT_FOUND')));

  it('GET a non-uuid id is 400', () =>
    request(app.getHttpServer()).get(`${base}/not-a-uuid`).expect(400));

  it('PATCH with an empty body is 400', async () => {
    const created = await request(app.getHttpServer())
      .post(base)
      .send(valid)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${base}/${created.body.id}`)
      .send({})
      .expect(400);
  });

  it('DELETE is 204, then GET is 404', async () => {
    const created = await request(app.getHttpServer())
      .post(base)
      .send(valid)
      .expect(201);
    await request(app.getHttpServer())
      .delete(`${base}/${created.body.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`${base}/${created.body.id}`)
      .expect(404);
  });

  it('R1: duplicate tags are 400', () =>
    request(app.getHttpServer())
      .post(base)
      .send({ ...valid, tags: ['a', 'a'] })
      .expect(400));

  it('R2: creating published with an empty body is 400', () =>
    request(app.getHttpServer())
      .post(base)
      .send({ title: 'x', status: 'published' })
      .expect(400));

  it('R3: changing a published title is 422 RULE_VIOLATION', async () => {
    const created = await request(app.getHttpServer())
      .post(base)
      .send({ ...valid, status: 'published' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${base}/${created.body.id}`)
      .send({ title: 'Renamed' })
      .expect(422)
      .expect((res) => expect(res.body.code).toBe('RULE_VIOLATION'));
  });

  it('PATCH {title} on a draft keeps body and tags (no defaults applied)', async () => {
    const created = await request(app.getHttpServer())
      .post(base)
      .send({ ...valid, tags: ['keep'] })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${base}/${created.body.id}`)
      .send({ title: 'Renamed' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ body: 'Hello', tags: ['keep'] }),
      );
  });
});
