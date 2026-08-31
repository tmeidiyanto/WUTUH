import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { deviceReadings, devices, lands } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateDeviceDto, IngestDto, UpdateDeviceDto } from './dto/iot.dto';

@Injectable()
export class IotService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
  ) {}

  /** Daftar perangkat + bacaan terakhir (untuk status online/offline). */
  list() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ d: devices, landName: lands.name })
        .from(devices)
        .leftJoin(lands, eq(devices.landId, lands.id))
        .orderBy(devices.code);

      const result = [];
      for (const r of rows) {
        const [last] = await tx
          .select()
          .from(deviceReadings)
          .where(eq(deviceReadings.deviceId, r.d.id))
          .orderBy(desc(deviceReadings.readAt))
          .limit(1);
        const lastAt = last?.readAt ?? null;
        const online = lastAt ? Date.now() - new Date(lastAt).getTime() < 24 * 3600 * 1000 : false;
        result.push({ ...r.d, landName: r.landName, lastValue: last?.value ?? null, lastReadAt: lastAt, online });
      }
      return result;
    });
  }

  create(dto: CreateDeviceDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx
        .select()
        .from(devices)
        .where(and(eq(devices.companyId, companyId), eq(devices.code, dto.code)));
      if (dup) throw new ConflictException(msg('device.codeTaken', { code: dto.code }));
      const apiKey = `wtd_${randomBytes(18).toString('hex')}`;
      const [row] = await tx.insert(devices).values({ companyId, ...dto, apiKey }).returning();
      return row;
    });
  }

  update(id: string, dto: UpdateDeviceDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(devices)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(devices.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('device.notFound'));
      return row;
    });
  }

  /** Bacaan sensor N jam terakhir (default 48 jam) untuk grafik. */
  readings(deviceId: string, hours = 48) {
    return this.uow.run(async (tx) => {
      const since = new Date(Date.now() - hours * 3600 * 1000);
      return tx
        .select()
        .from(deviceReadings)
        .where(and(eq(deviceReadings.deviceId, deviceId), gte(deviceReadings.readAt, since)))
        .orderBy(deviceReadings.readAt);
    });
  }

  /**
   * Terima data dari perangkat di lapangan. Endpoint publik — autentikasi
   * memakai apiKey perangkat. Tabel devices ber-policy RLS longgar saat tanpa
   * konteks (seperti users) agar pencarian apiKey global berhasil.
   */
  async ingest(dto: IngestDto) {
    const [device] = await this.db.select().from(devices).where(eq(devices.apiKey, dto.apiKey));
    if (!device || !device.isActive) throw new UnauthorizedException(msg('device.badApiKey'));
    return this.uow.run(
      async (tx) => {
        const [row] = await tx
          .insert(deviceReadings)
          .values({ companyId: device.companyId, deviceId: device.id, value: String(dto.value) })
          .returning();
        return { ok: true, readingId: row.id };
      },
      { companyId: device.companyId },
    );
  }
}
