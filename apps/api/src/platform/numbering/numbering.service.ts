import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { getContext } from '../tenancy/company-context';
import type { Tx } from '../db/db.types';
import { numberingSequences } from '../db/schema';

/** Nomor dokumen berurutan per company per doc_type (SKL-0001, PSN-0001, ...). */
@Injectable()
export class NumberingService {
  /** Ambil nomor berikutnya secara atomik (di dalam tx pemanggil). companyId eksplisit untuk alur publik (Pasar WUTUH). */
  async next(tx: Tx, docType: string, companyIdOverride?: string): Promise<string> {
    const companyId = companyIdOverride ?? getContext().companyId;
    const [row] = await tx
      .update(numberingSequences)
      .set({ nextValue: sql`${numberingSequences.nextValue} + 1` })
      .where(and(eq(numberingSequences.companyId, companyId), eq(numberingSequences.docType, docType)))
      .returning();

    if (!row) {
      // Fallback: buat sequence baru bila belum ada (company lama / doc_type baru).
      const [created] = await tx
        .insert(numberingSequences)
        .values({ companyId, docType, prefix: `${docType.toUpperCase().slice(0, 3)}-`, nextValue: 2 })
        .returning();
      return `${created.prefix}${String(1).padStart(created.padding, '0')}`;
    }
    return `${row.prefix}${String(row.nextValue - 1).padStart(row.padding, '0')}`;
  }
}
