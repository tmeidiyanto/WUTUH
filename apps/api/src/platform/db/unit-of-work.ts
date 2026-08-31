import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { getContext } from '../tenancy/company-context';
import { DRIZZLE, type DB, type Tx } from './db.types';

/**
 * Unit of Work: setiap use-case dibungkus SATU transaksi.
 * Di awal transaksi kita set `app.company_id` secara LOCAL (scoped per-transaksi)
 * lewat set_config(..., true) — inilah yang mengaktifkan Row-Level Security.
 *
 * Semua query (baca & tulis) harus lewat sini, karena di luar transaksi
 * GUC app.company_id tidak terpasang dan RLS akan memfilter semua baris.
 */
@Injectable()
export class UnitOfWork {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async run<T>(fn: (tx: Tx) => Promise<T>, opts?: { companyId?: string }): Promise<T> {
    const companyId = opts?.companyId ?? getContext().companyId;
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
      return fn(tx);
    });
  }
}
