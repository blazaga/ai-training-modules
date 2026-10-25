import { Ctx } from '@nestjs/microservices';
import { McpController, type McpContext, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { RuleViolationError } from '../common/errors/domain-error.js';
import { DeviceResponseSchema } from '../devices/device.schema.js';
import { UserResponseSchema } from '../users/user.schema.js';
import { UsersService } from '../users/users.service.js';
import type { DeviceRequest } from './device-auth.middleware.js';
import { runTool, type ToolResult } from './tool-result.js';

/** ch09: tools that depend on WHO is calling (the authenticated device). */
@McpController()
export class IdentityTools {
  constructor(private readonly users: UsersService) {}

  @Tool({
    name: 'whoami',
    description:
      'The device making this call and the user who owns it. HTTP transport only.',
    parameters: z.object({}),
  })
  whoami(@Ctx() ctx: McpContext): Promise<ToolResult> {
    return runTool(async () => {
      const device = ctx.getRawRequest<DeviceRequest>()?.mcpDevice;
      if (!device) {
        // stdio has no device: the local user who started the process is trusted.
        throw new RuleViolationError(
          'No device identity: this transport is not authenticated',
        );
      }
      const owner = await this.users.findOne(device.ownerUserId);
      return {
        device: DeviceResponseSchema.parse(device),
        owner: UserResponseSchema.parse(owner),
      };
    });
  }
}
