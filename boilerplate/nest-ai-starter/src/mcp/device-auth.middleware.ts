import type { NextFunction, Request, Response } from 'express';
import type { DevicesService } from '../devices/devices.service.js';
import type { Device } from '../devices/entities/device.entity.js';

/** Header names a device sends. Case-insensitive on the wire. */
export const ACCESS_KEY_ID_HEADER = 'x-access-key-id';
export const SECRET_KEY_HEADER = 'x-secret-key';

/** The request after authentication: tools read this via McpContext.getRawRequest(). */
export type DeviceRequest = Request & { mcpDevice?: Device };

/** One body for every failure, so callers cannot tell which check failed. */
export const DEVICE_UNAUTHORIZED = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Invalid device credentials',
} as const;

const header = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * ch09: device authentication for the MCP HTTP endpoint, at the TRANSPORT
 * level. A failure is a plain HTTP 401 before any JSON-RPC is read, which is
 * what MCP clients expect from an HTTP transport. (A Nest guard on the tool
 * controller would only produce a JSON-RPC error inside an HTTP 200.)
 *
 * The checks are those of DevicesService.verifyAccessKey (ch04): the key id
 * exists, the secret matches its hash (timing-safe), and the device is ACTIVE.
 * A rotated-away secret fails immediately, because nothing is cached.
 * Never log these headers.
 */
export function deviceAuth(devices: DevicesService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const accessKeyId = header(req, ACCESS_KEY_ID_HEADER);
    const secret = header(req, SECRET_KEY_HEADER);
    const verified =
      accessKeyId && secret
        ? devices.verifyAccessKey(accessKeyId, secret)
        : Promise.resolve(undefined);
    verified
      .then((device) => {
        if (!device) {
          res.status(401).json(DEVICE_UNAUTHORIZED);
          return;
        }
        (req as DeviceRequest).mcpDevice = device;
        next();
      })
      .catch(next);
  };
}
