import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpStrategy, StreamableHttpTransport } from '@rekog/mcp-nest';
import type { Env } from '../config/env.schema.js';
import { MCP_SERVER_INFO } from '../mcp/mcp-tools.module.js';

/**
 * ch08: serve the SAME MCP tools over Streamable HTTP, inside the main app.
 * main.ts AND the e2e tests call this, so tests exercise the real wiring.
 *
 * Every option below is spelled out, with its default, because the defaults
 * of @rekog/mcp-nest 2.0.8 (read from its source) are easy to misjudge:
 *   endpoint            '/mcp'        mounted on the HTTP adapter, OUTSIDE /api
 *   statefulMode        false         no Mcp-Session-Id; every POST stands alone
 *   enableJsonResponse  !statefulMode i.e. TRUE by default: plain JSON replies,
 *                                     no SSE. We set false to stream responses
 *                                     as Server-Sent Events (text/event-stream)
 *   security.allowedHosts 'localhost' DNS-rebinding protection: any other Host
 *                                     header is REJECTED. Set MCP_ALLOWED_HOSTS
 *                                     when deployed behind a real hostname.
 */
export async function attachMcp(app: INestApplication): Promise<void> {
  const config = app.get(ConfigService<Env, true>);
  const mcp = new McpStrategy({
    ...MCP_SERVER_INFO,
    transports: [
      new StreamableHttpTransport({
        endpoint: '/mcp',
        statefulMode: false,
        enableJsonResponse: false,
        security: {
          allowedHosts: config.get('MCP_ALLOWED_HOSTS', { infer: true }),
        },
      }),
    ],
  });
  mcp.setHttpAdapter(app.getHttpAdapter());
  app.connectMicroservice({ strategy: mcp });
  // Order matters: mount the MCP routes before the server accepts connections.
  await app.startAllMicroservices();
}
