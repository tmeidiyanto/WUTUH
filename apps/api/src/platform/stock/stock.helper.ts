import { ConflictException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db/db.types';
import { stockBalances, stockMovements } from '../db/schema';
import { msg } from '../../shared/errors';

export interface StockPost {
  companyId: string;
  warehouseId: string;
  commodityId: string;
  direction: 'masuk' | 'keluar';
  qty: string; // numeric string
  unit: string;
  refType: string;
  refId?: string | null;
  /** Siklus produksi asal barang (ketertelusuran stok masuk). */
  cycleId?: string | null;
  movementDate: string; // yyyy-mm-dd
  note?: string | null;
}

/**
 * Posting mutasi stok ATOMIK di dalam transaksi pemanggil:
 * catat kartu stok + update saldo. Mencegah stok minus (over-issue).
 */
export async function postStockMovement(tx: Tx, p: StockPost) {
  const [bal] = await tx
    .select()
    .from(stockBalances)
    .where(
      and(
        eq(stockBalances.companyId, p.companyId),
        eq(stockBalances.warehouseId, p.warehouseId),
        eq(stockBalances.commodityId, p.commodityId),
      ),
    );

  const current = Number(bal?.qty ?? 0);
  const delta = p.direction === 'masuk' ? Number(p.qty) : -Number(p.qty);
  const after = current + delta;
  if (after < 0) {
    throw new ConflictException(msg('stock.insufficient', { available: current, requested: p.qty }));
  }

  if (bal) {
    await tx
      .update(stockBalances)
      .set({ qty: String(after), unit: p.unit, updatedAt: new Date() })
      .where(eq(stockBalances.id, bal.id));
  } else {
    await tx.insert(stockBalances).values({
      companyId: p.companyId,
      warehouseId: p.warehouseId,
      commodityId: p.commodityId,
      qty: String(after),
      unit: p.unit,
    });
  }

  const [mv] = await tx
    .insert(stockMovements)
    .values({
      companyId: p.companyId,
      warehouseId: p.warehouseId,
      commodityId: p.commodityId,
      direction: p.direction,
      qty: p.qty,
      unit: p.unit,
      refType: p.refType,
      refId: p.refId ?? null,
      cycleId: p.cycleId ?? null,
      movementDate: p.movementDate,
      note: p.note ?? null,
    })
    .returning();
  return { movement: mv, balanceAfter: after };
}

/** Total stok sebuah komoditas di semua gudang (untuk validasi cepat). */
export async function totalStockOf(tx: Tx, companyId: string, commodityId: string): Promise<number> {
  const rows = await tx
    .select({ total: sql<string>`coalesce(sum(${stockBalances.qty}), 0)` })
    .from(stockBalances)
    .where(and(eq(stockBalances.companyId, companyId), eq(stockBalances.commodityId, commodityId)));
  return Number(rows[0]?.total ?? 0);
}
