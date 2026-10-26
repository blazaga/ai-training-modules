import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import type { Page } from '../common/persistence/repository.js';
import { DrizzleRepository } from '../common/persistence/drizzle-repository.js';
import { DB, type Db } from '../database/database.types.js';
import type { DevicesRepository } from './devices.repository.js';
import { devices } from './devices.table.js';
import type { Device } from './entities/device.entity.js';

/** SQLite storage for devices (drizzle). CRUD comes from DrizzleRepository. */
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

  async findPageByOwner(
    ownerUserId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Device>> {
    const mine = eq(devices.ownerUserId, ownerUserId);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(devices)
        .where(mine)
        .orderBy(asc(devices.createdAt), asc(devices.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(devices).where(mine),
    ]);
    return {
      items: rows.map((row) => this.toEntity(row)),
      total,
      limit,
      offset,
    };
  }
}
