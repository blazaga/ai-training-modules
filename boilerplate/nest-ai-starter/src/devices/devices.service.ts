import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  RuleViolationError,
} from '../common/errors/domain-error.js';
import {
  generateAccessKeyId,
  generateSecret,
  hashSecret,
  secretMatches,
} from './device-credentials.js';
import type { Entity, Page } from '../common/persistence/repository.js';
import {
  DEVICES_REPOSITORY,
  type DevicesRepository,
} from './devices.repository.js';
import type { z } from 'zod';
import type { CreateDeviceSchema } from './device.schema.js';
import type { CreateDeviceDto } from './dto/create-device.dto.js';
import type { UpdateDeviceDto } from './dto/update-device.dto.js';
import type { Device } from './entities/device.entity.js';

/**
 * Business logic for devices. Shape rules (types, lengths, enums) live in the
 * schema. Only rules that need state or more than one field belong here, and
 * they fail by throwing a DomainError, never by returning a flag.
 */
@Injectable()
export class DevicesService {
  constructor(
    @Inject(DEVICES_REPOSITORY) private readonly repo: DevicesRepository,
  ) {}

  async create(ownerId: string, input: CreateDeviceDto): Promise<Device> {
    // No create-time rules.
    return this.repo.create(await this.toStored(ownerId, input));
  }

  /** The create payload in its STORED shape: write-only inputs become private fields. */
  // `input` is typed as the parsed payload, not the DTO class: spreading a class instance
  // is flagged by lint (no-misused-spread), and the pipe hands over a plain object anyway.
  private toStored(
    ownerId: string,
    input: z.infer<typeof CreateDeviceSchema>,
  ): Promise<Omit<Device, keyof Entity>> | Omit<Device, keyof Entity> {
    // A new device is a draft with no credentials (spec); everything else is
    // server-owned and starts empty.
    return {
      ...input,
      ownerUserId: ownerId, // ch04b: the creating user owns it
      status: 'draft',
      accessKeyId: null,
      secretHash: null,
      secretLast4: null,
      secretRotatedAt: null,
      lastUsedAt: null,
      archivedAt: null,
    };
  }

  findPage(
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Device>> {
    return this.repo.findPageByOwner(ownerId, limit, offset);
  }

  /**
   * ch04b: scoped to the owner. Another user's device is NOT FOUND (404), not
   * forbidden, so device ids cannot be probed. Every method below goes through here.
   */
  async findOne(ownerId: string, id: string): Promise<Device> {
    const found = await this.repo.findById(id);
    if (!found || found.ownerUserId !== ownerId) {
      throw new NotFoundError('Device', id);
    }
    return found;
  }

  async update(
    ownerId: string,
    id: string,
    patch: UpdateDeviceDto,
  ): Promise<Device> {
    const current = await this.findOne(ownerId, id);
    // Spec R5: an archived device cannot be edited.
    if (current.status === 'archived') {
      throw new RuleViolationError('An archived device cannot be edited');
    }
    void current;
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundError('Device', id);
    return updated;
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const current = await this.findOne(ownerId, id);
    // Spec R4: only drafts are deleted; active devices are archived instead.
    if (current.status !== 'draft') {
      throw new RuleViolationError(
        'Only a draft device can be deleted; archive it instead',
      );
    }
    void current;
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Device', id);
  }

  // ---- added in ch04: device lifecycle and credentials (beyond the template) ----

  /**
   * Issue (first call) or rotate (later calls) the device's secret. Returns the
   * plain secret ONCE; only its hash is stored. Rotation keeps the access key
   * id and invalidates the old secret immediately: nothing caches it (spec).
   */
  async issueCredentials(
    ownerId: string,
    id: string,
  ): Promise<{ device: Device; accessKeyId: string; secret: string }> {
    const current = await this.findOne(ownerId, id);
    if (current.status === 'archived') {
      throw new RuleViolationError(
        'Credentials cannot be issued for an archived device',
      ); // spec R2
    }
    const accessKeyId = current.accessKeyId ?? generateAccessKeyId();
    const secret = generateSecret();
    const device = await this.repo.update(id, {
      accessKeyId,
      secretHash: hashSecret(secret),
      secretLast4: secret.slice(-4),
      secretRotatedAt: new Date().toISOString(),
    });
    if (!device) throw new NotFoundError('Device', id);
    return { device, accessKeyId, secret };
  }

  /** Spec R3: needs credentials and must not be archived. */
  async activate(ownerId: string, id: string): Promise<Device> {
    const current = await this.findOne(ownerId, id);
    if (current.status === 'archived') {
      throw new RuleViolationError('An archived device cannot be activated');
    }
    if (!current.accessKeyId) {
      throw new RuleViolationError('Issue credentials before activating');
    }
    const device = await this.repo.update(id, { status: 'active' });
    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  /** Spec R5: soft delete. Idempotent: archiving an archived device is a no-op. */
  async archive(ownerId: string, id: string): Promise<Device> {
    const current = await this.findOne(ownerId, id);
    if (current.status === 'archived') return current;
    const device = await this.repo.update(id, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });
    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  /** A decoy hash, so an unknown key id costs the same comparison work. */
  private readonly decoyHash = hashSecret(generateSecret());

  /**
   * The ACTIVE device these credentials belong to, or undefined. Used by the
   * MCP guard in ch09. Every failure looks the same to the caller.
   */
  async verifyAccessKey(
    accessKeyId: string,
    secret: string,
  ): Promise<Device | undefined> {
    const device = await this.repo.findByAccessKeyId(accessKeyId);
    const ok = secretMatches(secret, device?.secretHash ?? this.decoyHash);
    if (!device || !ok || device.status !== 'active') return undefined;
    return (
      (await this.repo.update(device.id, {
        lastUsedAt: new Date().toISOString(),
      })) ?? undefined
    );
  }
}
