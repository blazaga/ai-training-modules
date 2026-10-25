// ch06: the MCP server over STDIO, as a separate entrypoint.
//
//   node dist/mcp-stdio.js
//
// The MCP client starts this process and talks JSON-RPC over stdin/stdout, so
// STDOUT BELONGS TO THE PROTOCOL. Nest's logger is off; diagnostics go to stderr.
// Measured with the MCP SDK v2 client: a stray console.log line IS written into
// the protocol stream. That client silently skips a plain-text line and reports a
// JSON-shaped one as a protocol error; stricter clients may disconnect. A client-
// driven test cannot see this, so test/mcp-stdio.e2e-spec.ts reads raw stdout.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { McpStrategy, StdioTransport } from '@rekog/mcp-nest';
import { validateEnv } from './config/env.schema.js';
import { MCP_SERVER_INFO, McpToolsModule } from './mcp/mcp-tools.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    McpToolsModule,
  ],
})
class McpStdioModule {}

const app = await NestFactory.createMicroservice(McpStdioModule, {
  strategy: new McpStrategy({
    ...MCP_SERVER_INFO,
    transports: [new StdioTransport()],
  }),
  logger: false,
});
await app.listen();
process.stderr.write('mcp-stdio: ready\n');
