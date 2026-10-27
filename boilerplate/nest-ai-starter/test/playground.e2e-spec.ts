import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { PLAYGROUND } from '../src/playground/requests.js';

describe('GET /playground', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(() => app?.close());

  it('serves the page as HTML, outside the /api prefix', async () => {
    const res = await request(app.getHttpServer())
      .get('/playground')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Run all in order');
  });

  it('lists every request of requests.ts', async () => {
    const res = await request(app.getHttpServer())
      .get('/playground')
      .expect(200);
    for (const req of PLAYGROUND.flatMap((g) => g.requests))
      expect(res.text, req.name).toContain(JSON.stringify(req.name));
  });

  it('mirrors the lab 01 check: every lab test has a request, every request names a lab test', () => {
    const lab = readFileSync(
      join(import.meta.dirname, 'labs', '01-users-notes.lab-spec.ts'),
      'utf8',
    );
    const labTests = [...lab.matchAll(/^\s*it\('([^']+)'/gm)].map((m) => m[1]);
    expect(labTests.length).toBeGreaterThan(0);
    const named = PLAYGROUND.flatMap((g) => g.requests).flatMap((r) =>
      [r.check ?? []].flat(),
    );
    for (const t of labTests)
      expect(named, `no request for "${t}"`).toContain(t);
    for (const c of named)
      expect(labTests, `"${c}" is not a lab 01 test`).toContain(c);
  });

  it('cannot be broken out of its <script> by the data', async () => {
    const res = await request(app.getHttpServer())
      .get('/playground')
      .expect(200);
    expect(res.text.match(/<\/script>/g)).toHaveLength(1);
  });
});
