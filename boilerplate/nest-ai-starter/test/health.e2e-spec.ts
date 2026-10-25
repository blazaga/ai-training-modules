import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

describe('health (e2e)', () => {
  let app: INestApplication<App>;

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

  it('GET /api/health is 200 and unversioned', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' }));

  it('serves OpenAPI JSON with the notes routes', () =>
    request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200)
      .expect((res) =>
        expect(Object.keys(res.body.paths)).toContain('/api/v1/notes'),
      ));
});
