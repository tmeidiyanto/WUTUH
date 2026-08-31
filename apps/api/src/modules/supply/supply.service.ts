import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gt } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { getContext } from '../../platform/tenancy/company-context';
import { postStockMovement } from '../../platform/stock/stock.helper';
import { msg } from '../../shared/errors';
import {
  commodities,
  cycles,
  deliveries,
  finTransactions,
  stockBalances,
  stockMovements,
  warehouses,
} from '../../platform/db/schema';
import type {
  AdjustStockDto,
  CreateDeliveryDto,
  CreateWarehouseDto,
  UpdateDeliveryStatusDto,
  UpdateWarehouseDto,
} from './dto/supply.dto';

@Injectable()
export class SupplyService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
  ) {}

  // ---- Gudang ----
  listWarehouses() {
    return this.uow.run((tx) => tx.select().from(warehouses).orderBy(warehouses.code));
  }

  createWarehouse(dto: CreateWarehouseDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.companyId, companyId), eq(warehouses.code, dto.code)));
      if (dup) throw new ConflictException(msg('warehouse.codeTaken', { code: dto.code }));
      const [row] = await tx.insert(warehouses).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(warehouses)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(warehouses.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('warehouse.notFound'));
      return row;
    });
  }

  // ---- Stok ----
  listBalances() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({
          bal: stockBalances,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          commodityName: commodities.name,
          commodityCategory: commodities.category,
        })
        .from(stockBalances)
        .leftJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
        .leftJoin(commodities, eq(stockBalances.commodityId, commodities.id))
        .where(gt(stockBalances.qty, '0'))
        .orderBy(warehouses.code, commodities.name);
      return rows.map((r) => ({
        ...r.bal,
        warehouseName: r.warehouseName,
        warehouseCode: r.warehouseCode,
        commodityName: r.commodityName,
        commodityCategory: r.commodityCategory,
      }));
    });
  }

  listMovements() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ mv: stockMovements, warehouseName: warehouses.name, commodityName: commodities.name, cycleCode: cycles.code })
        .from(stockMovements)
        .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
        .leftJoin(commodities, eq(stockMovements.commodityId, commodities.id))
        .leftJoin(cycles, eq(stockMovements.cycleId, cycles.id))
        .orderBy(desc(stockMovements.createdAt))
        .limit(300);
      return rows.map((r) => ({ ...r.mv, warehouseName: r.warehouseName, commodityName: r.commodityName, cycleCode: r.cycleCode }));
    });
  }

  adjust(dto: AdjustStockDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      // Stok MASUK wajib menyebut siklus asal (ketertelusuran).
      if (dto.direction === 'masuk') {
        if (!dto.cycleId) throw new BadRequestException(msg('stock.cycleRequired'));
        const [cyc] = await tx.select().from(cycles).where(eq(cycles.id, dto.cycleId));
        if (!cyc) throw new NotFoundException(msg('cycle.notFound'));
      }
      return postStockMovement(tx, {
        companyId,
        warehouseId: dto.warehouseId,
        commodityId: dto.commodityId,
        direction: dto.direction,
        qty: dto.qty,
        unit: dto.unit,
        refType: 'penyesuaian',
        cycleId: dto.direction === 'masuk' ? dto.cycleId : null,
        movementDate: dto.movementDate,
        note: dto.note,
      });
    });
  }

  // ---- Pengiriman / logistik ----
  listDeliveries() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ d: deliveries, commodityName: commodities.name })
        .from(deliveries)
        .leftJoin(commodities, eq(deliveries.commodityId, commodities.id))
        .orderBy(desc(deliveries.createdAt))
        .limit(300);
      return rows.map((r) => ({ ...r.d, commodityName: r.commodityName }));
    });
  }

  createDelivery(dto: CreateDeliveryDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const code = await this.numbering.next(tx, 'delivery');
      const [row] = await tx
        .insert(deliveries)
        .values({ companyId, code, ...dto, cost: dto.cost ?? '0' })
        .returning();
      return row;
    });
  }

  /** Status selesai + ada biaya → otomatis tercatat pengeluaran transportasi. */
  updateDeliveryStatus(id: string, dto: UpdateDeliveryStatusDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [existing] = await tx.select().from(deliveries).where(eq(deliveries.id, id));
      if (!existing) throw new NotFoundException(msg('delivery.notFound'));
      const [row] = await tx
        .update(deliveries)
        .set({ status: dto.status, updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();
      if (dto.status === 'selesai' && existing.status !== 'selesai' && Number(existing.cost) > 0) {
        await tx.insert(finTransactions).values({
          companyId,
          txDate: existing.deliveryDate,
          kind: 'keluar',
          category: 'transportasi',
          amount: existing.cost,
          refType: 'manual',
          refId: existing.id,
          note: `Ongkos kirim ${existing.code} (${existing.origin} → ${existing.destination})`,
        });
      }
      return row;
    });
  }
}
