import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { attachMcp } from './bootstrap/attach-mcp.js';
import { configureApp } from './bootstrap/configure-app.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await attachMcp(app); // ch08: MCP over Streamable HTTP at /mcp

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  await app.listen(port);
  // Log the port only. Never print the config object: it may hold credentials.
  new Logger('Bootstrap').log(`listening on port ${port}`);
}

await bootstrap();
