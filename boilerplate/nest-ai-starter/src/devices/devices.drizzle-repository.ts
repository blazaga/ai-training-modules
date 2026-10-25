import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleRepository } from '../common/persistence/drizzle-repository.js';
import { DB, type Db } from '../database/database.types.js';
import type { DevicesRepository } from './devices.repository.js';
import { devices } from './devices.table.js';
import type { Device } from './entities/device.entity.js';

/** Postgres storage for devices (drizzle). CRUD comes from DrizzleRepository. */
@Injectable()
export class DrizzleDevicesRepository
  extends DrizzleRepository<Device>
  implements DevicesRepository
{
  constructor(@Inject(DB) db: Db) {
    super(db, devices, 'Device');
  }

  async findByAccessKeyId(accessKeyId: string): Promise<Device | undefined> {
    const [row] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.accessKeyId, accessKeyId))
      .limit(1);
    return row ? this.toEntity(row) : undefined;
  }
}
