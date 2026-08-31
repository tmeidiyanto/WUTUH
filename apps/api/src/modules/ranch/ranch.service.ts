import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { postStockMovement } from '../../platform/stock/stock.helper';
import { msg } from '../../shared/errors';
import {
  commodities,
  finTransactions,
  lands,
  livestock,
  livestockHealth,
  livestockProduction,
} from '../../platform/db/schema';
import type {
  CreateHealthDto,
  CreateLivestockDto,
  CreateProductionDto,
  UpdateLivestockDto,
} from './dto/ranch.dto';

@Injectable()
export class RanchService {
  constructor(private readonly uow: UnitOfWork) {}

  // ---- Ternak ----
  listLivestock() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ animal: livestock, commodityName: commodities.name, penName: lands.name })
        .from(livestock)
        .leftJoin(commodities, eq(livestock.commodityId, commodities.id))
        .leftJoin(lands, eq(livestock.landId, lands.id))
        .orderBy(desc(livestock.createdAt));
      return rows.map((r) => ({ ...r.animal, commodityName: r.commodityName, penName: r.penName }));
    });
  }

  createLivestock(dto: CreateLivestockDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx
        .select()
        .from(livestock)
        .where(and(eq(livestock.companyId, companyId), eq(livestock.tag, dto.tag)));
      if (dup) throw new ConflictException(msg('livestock.tagTaken', { tag: dto.tag }));
      const [row] = await tx.insert(livestock).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  updateLivestock(id: string, dto: UpdateLivestockDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(livestock)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(livestock.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('livestock.notFound'));
      return row;
    });
  }

  // ---- Produksi harian (telur, susu, ...) ----
  listProduction() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({
          rec: livestockProduction,
          commodityName: commodities.name,
          penName: lands.name,
          tag: livestock.tag,
        })
        .from(livestockProduction)
        .leftJoin(commodities, eq(livestockProduction.commodityId, commodities.id))
        .leftJoin(lands, eq(livestockProduction.landId, lands.id))
        .leftJoin(livestock, eq(livestockProduction.livestockId, livestock.id))
        .orderBy(desc(livestockProduction.productionDate))
        .limit(200);
      return rows.map((r) => ({ ...r.rec, commodityName: r.commodityName, penName: r.penName, tag: r.tag }));
    });
  }

  /** Produksi masuk gudang otomatis bila warehouseId diisi (rantai RANCH→WAREHOUSE). */
  addProduction(dto: CreateProductionDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [rec] = await tx.insert(livestockProduction).values({ companyId, ...dto }).returning();
      if (dto.warehouseId) {
        // Siklus asal diturunkan dari ternaknya (bila dicatat per ternak & ternak ber-siklus).
        let cycleId: string | null = null;
        if (dto.livestockId) {
          const [animal] = await tx.select().from(livestock).where(eq(livestock.id, dto.livestockId));
          cycleId = animal?.cycleId ?? null;
        }
        await postStockMovement(tx, {
          companyId,
          warehouseId: dto.warehouseId,
          commodityId: dto.commodityId,
          direction: 'masuk',
          qty: dto.qty,
          unit: dto.unit,
          refType: 'produksi_ternak',
          refId: rec.id,
          cycleId,
          movementDate: dto.productionDate,
          note: dto.note ?? 'Produksi ternak harian',
        });
      }
      return rec;
    });
  }

  // ---- Kesehatan ----
  listHealth() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ rec: livestockHealth, tag: livestock.tag })
        .from(livestockHealth)
        .leftJoin(livestock, eq(livestockHealth.livestockId, livestock.id))
        .orderBy(desc(livestockHealth.healthDate))
        .limit(200);
      return rows.map((r) => ({ ...r.rec, tag: r.tag }));
    });
  }

  /** Biaya kesehatan > 0 otomatis tercatat sebagai pengeluaran (kategori obat). */
  addHealth(dto: CreateHealthDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [animal] = await tx.select().from(livestock).where(eq(livestock.id, dto.livestockId));
      if (!animal) throw new NotFoundException(msg('livestock.notFound'));
      const [rec] = await tx
        .insert(livestockHealth)
        .values({ companyId, ...dto, cost: dto.cost ?? '0' })
        .returning();
      if (Number(rec.cost) > 0) {
        await tx.insert(finTransactions).values({
          companyId,
          txDate: rec.healthDate,
          kind: 'keluar',
          category: 'obat',
          amount: rec.cost,
          cycleId: animal.cycleId,
          refType: 'kesehatan',
          refId: rec.id,
          note: `${rec.action} ${animal.tag}${rec.medicine ? ` (${rec.medicine})` : ''}`,
        });
      }
      return rec;
    });
  }
}
