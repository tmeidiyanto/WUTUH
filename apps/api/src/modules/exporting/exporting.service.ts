import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { getContext } from '../../platform/tenancy/company-context';
import { postStockMovement } from '../../platform/stock/stock.helper';
import { commodities, exportShipments, finTransactions } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateShipmentDto, UpdateShipmentDto } from './dto/exporting.dto';

const FLOW = ['persiapan', 'dokumen', 'pengapalan', 'tiba', 'selesai'];

@Injectable()
export class ExportingService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
  ) {}

  list() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ s: exportShipments, commodityName: commodities.name })
        .from(exportShipments)
        .leftJoin(commodities, eq(exportShipments.commodityId, commodities.id))
        .orderBy(desc(exportShipments.createdAt));
      return rows.map((r) => ({ ...r.s, commodityName: r.commodityName }));
    });
  }

  create(dto: CreateShipmentDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const code = await this.numbering.next(tx, 'export');
      const [row] = await tx.insert(exportShipments).values({ companyId, code, ...dto }).returning();
      return row;
    });
  }

  /**
   * Update status/dokumen. Status hanya boleh maju:
   *  - masuk 'pengapalan' → stok keluar dari gudang sumber (bila diisi).
   *  - 'selesai' + mata uang IDR → pemasukan penjualan ekspor otomatis tercatat.
   */
  update(id: string, dto: UpdateShipmentDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [existing] = await tx.select().from(exportShipments).where(eq(exportShipments.id, id));
      if (!existing) throw new NotFoundException(msg('export.notFound'));

      if (dto.status && dto.status !== existing.status) {
        if (FLOW.indexOf(dto.status) < FLOW.indexOf(existing.status)) {
          throw new BadRequestException(msg('export.forwardOnly'));
        }
        if (
          FLOW.indexOf(dto.status) >= FLOW.indexOf('pengapalan') &&
          FLOW.indexOf(existing.status) < FLOW.indexOf('pengapalan') &&
          existing.warehouseId
        ) {
          await postStockMovement(tx, {
            companyId,
            warehouseId: existing.warehouseId,
            commodityId: existing.commodityId,
            direction: 'keluar',
            qty: existing.qty,
            unit: existing.unit,
            refType: 'ekspor',
            refId: existing.id,
            movementDate: new Date().toISOString().slice(0, 10),
            note: `Pengapalan ekspor ${existing.code} → ${existing.destinationCountry}`,
          });
        }
        if (dto.status === 'selesai' && existing.currency === 'IDR') {
          await tx.insert(finTransactions).values({
            companyId,
            txDate: new Date().toISOString().slice(0, 10),
            kind: 'masuk',
            category: 'penjualan',
            amount: existing.valueAmount,
            refType: 'ekspor',
            refId: existing.id,
            note: `Ekspor ${existing.code} selesai (${existing.destinationCountry})`,
          });
        }
      }

      const [row] = await tx
        .update(exportShipments)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(exportShipments.id, id))
        .returning();
      return row;
    });
  }
}
