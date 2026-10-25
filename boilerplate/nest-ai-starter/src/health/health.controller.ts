import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

/** Liveness probe at GET /api/health (unversioned, so probes survive API v2). */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
