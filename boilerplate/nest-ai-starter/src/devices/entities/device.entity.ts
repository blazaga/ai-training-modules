import type { z } from 'zod';
import type { DeviceResponseSchema, DeviceSchema } from '../device.schema.js';

/** Derived from the schemas: never hand-write fields here. */
export type Device = z.infer<typeof DeviceSchema>;

/** A Device without its private fields: the only shape that leaves the API. */
export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;
