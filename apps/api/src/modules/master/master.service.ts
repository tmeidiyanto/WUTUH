import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { commodities, lands } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateCommodityDto, CreateLandDto, UpdateCommodityDto, UpdateLandDto } from './dto/master.dto';

@Injectable()
export class MasterService {
  constructor(private readonly uow: UnitOfWork) {}

  // ---- Lahan ----
  listLands() {
    return this.uow.run((tx) => tx.select().from(lands).orderBy(asc(lands.code)));
  }

  createLand(dto: CreateLandDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx.select().from(lands).where(and(eq(lands.companyId, companyId), eq(lands.code, dto.code)));
      if (dup) throw new ConflictException(msg('land.codeTaken', { code: dto.code }));
      const [row] = await tx.insert(lands).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  updateLand(id: string, dto: UpdateLandDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(lands)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(lands.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('land.notFound'));
      return row;
    });
  }

  // ---- Komoditas ----
  listCommodities() {
    return this.uow.run((tx) => tx.select().from(commodities).orderBy(asc(commodities.name)));
  }

  createCommodity(dto: CreateCommodityDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx
        .select()
        .from(commodities)
        .where(and(eq(commodities.companyId, companyId), eq(commodities.code, dto.code)));
      if (dup) throw new ConflictException(msg('commodity.codeTaken', { code: dto.code }));
      const [row] = await tx.insert(commodities).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  updateCommodity(id: string, dto: UpdateCommodityDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(commodities)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(commodities.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('commodity.notFound'));
      return row;
    });
  }
}
