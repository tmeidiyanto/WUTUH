import { date, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { cycles } from './farm';

/**
 * Kas usaha tani (WUTUH Finance) — pemasukan & pengeluaran sederhana.
 * Bisa ditautkan ke siklus produksi untuk hitung laba/rugi per siklus.
 */
export const finTransactions = pgTable('fin_transactions', {
  id: idPk(),
  companyId: companyId(),
  txDate: date('tx_date').notNull(),
  /** masuk | keluar */
  kind: text('kind').notNull(),
  /** penjualan | pembelian_input | tenaga_kerja | transportasi | sewa | pakan | obat | alat | lainnya */
  category: text('category').notNull().default('lainnya'),
  amount: numeric('amount').notNull(),
  cycleId: uuid('cycle_id').references(() => cycles.id),
  /** Sumber otomatis: pesanan | ekspor | kegiatan | kesehatan | manual */
  refType: text('ref_type').notNull().default('manual'),
  refId: uuid('ref_id'),
  note: text('note'),
  ...timestamps,
});
