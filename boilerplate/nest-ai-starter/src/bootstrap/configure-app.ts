import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Env } from '../config/env.schema.js';
import { renderPlayground } from '../playground/playground-page.js';
import { PLAYGROUND } from '../playground/requests.js';

/**
 * Everything that shapes the HTTP surface. main.ts AND the e2e tests call this,
 * so the tests exercise the same prefix, versioning and docs as production.
 * A setting applied only in main.ts is untested by construction.
 *
 * Routes: /api/v1/<resource>, /api/health, and when SWAGGER_ENABLED: /api/docs and
 * /playground (a page listing the module 1 requests, each sent with one click).
 * Validation and the DomainError filter are registered in AppModule (APP_PIPE,
 * APP_FILTER), so they also apply in tests that never call this function.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('nest-ai-starter').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', app, doc);

    // Outside the /api prefix on purpose: it is a page for people, not part of the API.
    const page = renderPlayground(PLAYGROUND);
    app
      .getHttpAdapter()
      .get(
        '/playground',
        (_req: unknown, res: { type(t: string): { send(b: string): void } }) =>
          res.type('html').send(page),
      );
  }
}
