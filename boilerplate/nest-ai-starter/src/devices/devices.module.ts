import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller.js';
import { DrizzleDevicesRepository } from './devices.drizzle-repository.js';
import { DEVICES_REPOSITORY } from './devices.repository.js';
import { DevicesService } from './devices.service.js';

@Module({
  controllers: [DevicesController],
  providers: [
    DevicesService,
    // Postgres via drizzle (DB is provided globally by DatabaseModule).
    { provide: DEVICES_REPOSITORY, useClass: DrizzleDevicesRepository },
  ],
  exports: [DevicesService],
})
export class DevicesModule {}
