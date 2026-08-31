import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { getContext } from '../../platform/tenancy/company-context';
import { postStockMovement } from '../../platform/stock/stock.helper';
import { STAGES, stageIndex, nextStage } from '../../shared/stages';
import { msg } from '../../shared/errors';
import { decodeImageDataUrl, saveUploadFile } from '../../shared/images';
import type { Tx } from '../../platform/db/db.types';
import {
  commodities,
  companies,
  cycleActivities,
  cycles,
  cycleStageHistory,
  deviceReadings,
  devices,
  finTransactions,
  harvests,
  lands,
  livestock,
  orders,
  stockMovements,
  warehouses,
} from '../../platform/db/schema';
import type {
  AdvanceStageDto,
  CreateActivityDto,
  CreateCycleDto,
  CreateHarvestDto,
  UpdateCycleDto,
} from './dto/farm.dto';

@Injectable()
export class FarmService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
  ) {}

  /** Daftar siklus (opsional filter kategori: tanaman/kebun/ternak). */
  list(category?: string) {
    return this.uow.run(async (tx) => {
      const where = category ? eq(cycles.category, category) : undefined;
      const rows = await tx
        .select({
          cycle: cycles,
          commodityName: commodities.name,
          commodityUnit: commodities.unit,
          landName: lands.name,
        })
        .from(cycles)
        .leftJoin(commodities, eq(cycles.commodityId, commodities.id))
        .leftJoin(lands, eq(cycles.landId, lands.id))
        .where(where)
        .orderBy(desc(cycles.createdAt));
      return rows.map((r) => ({ ...r.cycle, commodityName: r.commodityName, commodityUnit: r.commodityUnit, landName: r.landName }));
    });
  }

  /** Detail siklus + kegiatan + panen + riwayat tahap. */
  detail(id: string) {
    return this.uow.run(async (tx) => {
      const cycle = await this.mustGet(tx, id);
      // Berurutan (bukan Promise.all): satu transaksi = satu koneksi pg.
      const acts = await tx.select().from(cycleActivities).where(eq(cycleActivities.cycleId, id)).orderBy(desc(cycleActivities.activityDate));
      const hvs = await tx.select().from(harvests).where(eq(harvests.cycleId, id)).orderBy(desc(harvests.harvestDate));
      const hist = await tx.select().from(cycleStageHistory).where(eq(cycleStageHistory.cycleId, id)).orderBy(asc(cycleStageHistory.at));
      const [commodity] = await tx.select().from(commodities).where(eq(commodities.id, cycle.commodityId));
      const land = cycle.landId ? (await tx.select().from(lands).where(eq(lands.id, cycle.landId)))[0] : null;
      const totalCost = acts.reduce((s, a) => s + Number(a.cost), 0);
      const totalHarvest = hvs.reduce((s, h) => s + Number(h.qty), 0);
      // Prediksi panen sederhana: luas × rata-rata hasil per ha komoditas.
      const predictedHarvest =
        cycle.areaHa && commodity?.avgYieldPerHa ? Number(cycle.areaHa) * Number(commodity.avgYieldPerHa) : null;
      return {
        ...cycle,
        commodityName: commodity?.name,
        commodityUnit: commodity?.unit,
        landName: land?.name ?? null,
        activities: acts,
        harvests: hvs,
        stageHistory: hist,
        totalCost,
        totalHarvest,
        predictedHarvest,
      };
    });
  }

  create(dto: CreateCycleDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const code = await this.numbering.next(tx, 'cycle');
      const [row] = await tx
        .insert(cycles)
        .values({ companyId, code, ...dto })
        .returning();
      await tx.insert(cycleStageHistory).values({
        companyId,
        cycleId: row.id,
        fromStage: null,
        toStage: 'land',
        byUserId: getContext().userId,
        note: 'Siklus dibuat',
      });
      return row;
    });
  }

  update(id: string, dto: UpdateCycleDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(cycles)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(cycles.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('cycle.notFound'));
      return row;
    });
  }

  /** Majukan tahap rantai nilai (default: satu tahap ke depan). */
  advance(id: string, dto: AdvanceStageDto) {
    const ctx = getContext();
    return this.uow.run(async (tx) => {
      const cycle = await this.mustGet(tx, id);
      const target = dto.toStage ?? nextStage(cycle.stage);
      if (!target) throw new BadRequestException(msg('cycle.lastStage'));
      if (!STAGES.includes(target as (typeof STAGES)[number])) {
        throw new BadRequestException(msg('cycle.unknownStage', { stage: target }));
      }
      if (stageIndex(target) <= stageIndex(cycle.stage)) {
        throw new BadRequestException(msg('cycle.stageMustAdvance'));
      }
      const [row] = await tx
        .update(cycles)
        .set({ stage: target, updatedAt: new Date() })
        .where(eq(cycles.id, id))
        .returning();
      await tx.insert(cycleStageHistory).values({
        companyId: ctx.companyId,
        cycleId: id,
        fromStage: cycle.stage,
        toStage: target,
        byUserId: ctx.userId,
        note: dto.note,
      });
      return row;
    });
  }

  /** Catat kegiatan; biaya > 0 otomatis tercatat sebagai pengeluaran di WUTUH Finance. */
  async addActivity(cycleId: string, dto: CreateActivityDto) {
    const companyId = getContext().companyId;
    const { photoDataUrl, ...data } = dto;
    const photoUrl = await this.savePhoto('kegiatan', cycleId, photoDataUrl);
    return this.uow.run(async (tx) => {
      await this.mustGet(tx, cycleId);
      const [act] = await tx
        .insert(cycleActivities)
        .values({ companyId, cycleId, ...data, cost: data.cost ?? '0', photoUrl })
        .returning();
      if (Number(act.cost) > 0) {
        const category = act.activityType === 'pakan' ? 'pakan' : act.activityType === 'pemupukan' ? 'pembelian_input' : 'lainnya';
        await tx.insert(finTransactions).values({
          companyId,
          txDate: act.activityDate,
          kind: 'keluar',
          category,
          amount: act.cost,
          cycleId,
          refType: 'kegiatan',
          refId: act.id,
          note: `Kegiatan ${act.activityType}${act.description ? `: ${act.description}` : ''}`,
        });
      }
      return act;
    });
  }

  /**
   * Catat panen. Bila gudang diisi → stok bertambah otomatis dan tahap siklus
   * minimal maju ke 'harvest' (rantai LAND→...→WAREHOUSE tersambung).
   */
  async addHarvest(cycleId: string, dto: CreateHarvestDto) {
    const ctx = getContext();
    const { photoDataUrl, ...data } = dto;
    const photoUrl = await this.savePhoto('panen', cycleId, photoDataUrl);
    return this.uow.run(async (tx) => {
      const cycle = await this.mustGet(tx, cycleId);
      if (data.warehouseId) {
        const [wh] = await tx.select().from(warehouses).where(eq(warehouses.id, data.warehouseId));
        if (!wh) throw new BadRequestException(msg('warehouse.notFound'));
      }
      const [hv] = await tx
        .insert(harvests)
        .values({ companyId: ctx.companyId, cycleId, ...data, photoUrl })
        .returning();

      if (dto.warehouseId) {
        await postStockMovement(tx, {
          companyId: ctx.companyId,
          warehouseId: dto.warehouseId,
          commodityId: cycle.commodityId,
          direction: 'masuk',
          qty: dto.qty,
          unit: dto.unit,
          refType: 'panen',
          refId: hv.id,
          cycleId,
          movementDate: dto.harvestDate,
          note: `Panen ${cycle.code}`,
        });
      }

      // Tahap otomatis: minimal 'harvest'; bila masuk gudang → 'warehouse'.
      const targetStage = dto.warehouseId ? 'warehouse' : 'harvest';
      if (stageIndex(cycle.stage) < stageIndex(targetStage)) {
        await tx.update(cycles).set({ stage: targetStage, updatedAt: new Date() }).where(eq(cycles.id, cycleId));
        await tx.insert(cycleStageHistory).values({
          companyId: ctx.companyId,
          cycleId,
          fromStage: cycle.stage,
          toStage: targetStage,
          byUserId: ctx.userId,
          note: `Panen ${dto.qty} ${dto.unit}${dto.warehouseId ? ' → masuk gudang' : ''}`,
        });
      }
      return hv;
    });
  }

  /** Buat/ambil kode lacak publik (QR) untuk siklus — idempoten. */
  share(id: string) {
    return this.uow.run(async (tx) => {
      const cycle = await this.mustGet(tx, id);
      if (cycle.traceCode) return { traceCode: cycle.traceCode };
      // 12 karakter base32 tanpa huruf ambigu — ± 60 bit, aman dari tebakan.
      const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      const buf = randomBytes(12);
      let code = 'WT';
      for (let i = 0; i < 12; i++) code += alphabet[buf[i] % alphabet.length];
      const [row] = await tx
        .update(cycles)
        .set({ traceCode: code, updatedAt: new Date() })
        .where(eq(cycles.id, id))
        .returning();
      return { traceCode: row.traceCode };
    });
  }

  /**
   * Laporan Ketertelusuran lengkap satu siklus — dari lahan sampai pelanggan:
   * identitas, linimasa tahap, kegiatan, panen, mutasi gudang (via cycle_id),
   * penjualan (orders ber-cycleId), keuangan, ternak (bila kategori ternak),
   * dan sensor di lahannya. Semua kueri berurutan dalam satu transaksi (RLS).
   */
  trace(id: string) {
    return this.uow.run(async (tx) => {
      const cycle = await this.mustGet(tx, id);
      const [commodity] = await tx.select().from(commodities).where(eq(commodities.id, cycle.commodityId));
      const land = cycle.landId ? (await tx.select().from(lands).where(eq(lands.id, cycle.landId)))[0] ?? null : null;
      const [company] = await tx.select().from(companies).where(eq(companies.id, cycle.companyId));

      const history = await tx
        .select()
        .from(cycleStageHistory)
        .where(eq(cycleStageHistory.cycleId, id))
        .orderBy(asc(cycleStageHistory.at));
      const activities = await tx
        .select()
        .from(cycleActivities)
        .where(eq(cycleActivities.cycleId, id))
        .orderBy(asc(cycleActivities.activityDate));
      const harvestRows = await tx
        .select({ h: harvests, warehouseName: warehouses.name })
        .from(harvests)
        .leftJoin(warehouses, eq(harvests.warehouseId, warehouses.id))
        .where(eq(harvests.cycleId, id))
        .orderBy(asc(harvests.harvestDate));
      const movementRows = await tx
        .select({ m: stockMovements, warehouseName: warehouses.name })
        .from(stockMovements)
        .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
        .where(eq(stockMovements.cycleId, id))
        .orderBy(asc(stockMovements.movementDate));
      const orderRows = await tx.select().from(orders).where(eq(orders.cycleId, id)).orderBy(asc(orders.orderDate));
      const finRows = await tx
        .select()
        .from(finTransactions)
        .where(eq(finTransactions.cycleId, id))
        .orderBy(asc(finTransactions.txDate));

      let animals: (typeof livestock.$inferSelect)[] = [];
      if (cycle.category === 'ternak') {
        animals = await tx.select().from(livestock).where(eq(livestock.cycleId, id));
      }

      const sensors: Array<{ code: string; name: string; deviceType: string; unit: string; lastValue: string | null; lastReadAt: Date | null }> = [];
      if (cycle.landId) {
        const devRows = await tx.select().from(devices).where(eq(devices.landId, cycle.landId));
        for (const d of devRows) {
          const [last] = await tx
            .select()
            .from(deviceReadings)
            .where(eq(deviceReadings.deviceId, d.id))
            .orderBy(desc(deviceReadings.readAt))
            .limit(1);
          sensors.push({ code: d.code, name: d.name, deviceType: d.deviceType, unit: d.unit, lastValue: last?.value ?? null, lastReadAt: last?.readAt ?? null });
        }
      }

      // Metrik ringkas
      const totalHarvest = harvestRows.reduce((s, r) => s + Number(r.h.qty), 0);
      const income = finRows.filter((f) => f.kind === 'masuk').reduce((s, f) => s + Number(f.amount), 0);
      const expense = finRows.filter((f) => f.kind === 'keluar').reduce((s, f) => s + Number(f.amount), 0);
      const expenseByCategory: Record<string, number> = {};
      for (const f of finRows) {
        if (f.kind === 'keluar') expenseByCategory[f.category] = (expenseByCategory[f.category] ?? 0) + Number(f.amount);
      }
      const predicted =
        cycle.areaHa && commodity?.avgYieldPerHa ? Number(cycle.areaHa) * Number(commodity.avgYieldPerHa) : null;
      const soldQty = orderRows
        .filter((o) => o.status !== 'batal')
        .reduce((s, o) => s + Number(o.qty), 0);

      return {
        generatedAt: new Date().toISOString(),
        company: company
          ? { name: company.name, businessType: company.businessType, province: company.province, regency: company.regency, phone: company.phone }
          : null,
        cycle: {
          ...cycle,
          commodityName: commodity?.name ?? null,
          commodityUnit: commodity?.unit ?? 'kg',
          commodityCategory: commodity?.category ?? null,
        },
        land,
        history,
        activities,
        harvests: harvestRows.map((r) => ({ ...r.h, warehouseName: r.warehouseName })),
        movements: movementRows.map((r) => ({ ...r.m, warehouseName: r.warehouseName })),
        orders: orderRows,
        finance: { rows: finRows, income, expense, net: income - expense, expenseByCategory },
        animals,
        sensors,
        metrics: {
          totalHarvest,
          predicted,
          yieldPerHa: cycle.areaHa && Number(cycle.areaHa) > 0 ? totalHarvest / Number(cycle.areaHa) : null,
          costPerUnit: totalHarvest > 0 ? expense / totalHarvest : null,
          soldQty,
        },
      };
    });
  }

  private async mustGet(tx: Tx, id: string) {
    const [row] = await tx.select().from(cycles).where(eq(cycles.id, id));
    if (!row) throw new NotFoundException(msg('cycle.notFound'));
    return row;
  }

  /** Simpan foto kegiatan/panen (data URL → uploads/<subdir>/); null bila tidak ada. */
  private async savePhoto(subdir: 'kegiatan' | 'panen', cycleId: string, dataUrl?: string) {
    if (!dataUrl) return null;
    const { buf, ext } = decodeImageDataUrl(dataUrl);
    return saveUploadFile(subdir, `${cycleId}-${Date.now()}.${ext}`, buf);
  }
}
