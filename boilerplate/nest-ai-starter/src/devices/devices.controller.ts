import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page } from '../common/persistence/repository.js';
import { PageQueryDto } from '../common/schemas/page-query.schema.js';
import { DeviceResponseSchema } from './device.schema.js';
import { DevicesService } from './devices.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-device.dto.js';
import type { Device, DeviceResponse } from './entities/device.entity.js';

/** Strip private fields. Every value this controller returns passes through here. */
const toResponse = (entity: Device): DeviceResponse =>
  DeviceResponseSchema.parse(entity);

/**
 * HTTP only: parse, delegate, return. No business logic here (it goes in the
 * service) and no try/catch (DomainExceptionFilter maps errors).
 * Routes: /api/v1/devices
 */
@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Post()
  async create(@Body() body: CreateDeviceDto): Promise<DeviceResponse> {
    return toResponse(await this.service.create(body));
  }

  @Get()
  async findPage(@Query() query: PageQueryDto): Promise<Page<DeviceResponse>> {
    const page = await this.service.findPage(query.limit, query.offset);
    return { ...page, items: page.items.map(toResponse) };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceResponse> {
    return toResponse(await this.service.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDeviceDto,
  ): Promise<DeviceResponse> {
    return toResponse(await this.service.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ---- added in ch04: lifecycle and credentials (beyond the template) ----

  /**
   * Issue or rotate credentials. The ONLY response that ever contains the
   * plain `secret`: store it now, it cannot be shown again (spec).
   */
  @Post(':id/credentials')
  @HttpCode(HttpStatus.OK)
  async issueCredentials(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceResponse & { secret: string }> {
    const issued = await this.service.issueCredentials(id);
    return { ...toResponse(issued.device), secret: issued.secret };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceResponse> {
    return toResponse(await this.service.activate(id));
  }

  /** Soft delete: the device stays, with status `archived` and `archivedAt` set. */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeviceResponse> {
    return toResponse(await this.service.archive(id));
  }
}
