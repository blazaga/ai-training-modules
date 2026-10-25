import type { Repository } from '../common/persistence/repository.js';
import type { Device } from './entities/device.entity.js';

/** Injection token: services depend on the port, never on a storage class. */
export const DEVICES_REPOSITORY = Symbol('DEVICES_REPOSITORY');

/** The generic CRUD port plus the lookups this resource needs. */
export interface DevicesRepository extends Repository<Device> {
  /** For authentication (ch09): the device that owns this access key id. */
  findByAccessKeyId(accessKeyId: string): Promise<Device | undefined>;
}
