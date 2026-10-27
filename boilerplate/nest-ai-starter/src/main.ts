import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  try {
    await app.listen(port);
  } catch (error) {
    // Nest has already logged "successfully started" by now, so a bare stack trace here
    // reads like a running app (found in a dry run). Say what is wrong and how to fix it.
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      new Logger('Bootstrap').error(
        `port ${port} is already in use: set another one in .env (PORT=3100) and use it in the URL`,
      );
      await app.close();
      process.exit(1);
    }
    throw error;
  }
  // Log the port only. Never print the config object: it may hold credentials.
  new Logger('Bootstrap').log(`listening on port ${port}`);
}

await bootstrap();
