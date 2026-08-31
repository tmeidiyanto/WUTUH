import { date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities, lands } from './master';

/**
 * Siklus Produksi — entitas inti WUTUH yang menghubungkan seluruh rantai.
 * Satu siklus = satu musim tanam / satu angkatan ternak / satu periode kebun,
 * bergerak melalui 13 tahap rantai nilai (land → ... → customer).
 */
export const cycles = pgTable(
  'cycles',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** tanaman (Farm) | kebun (Garden) | ternak (Ranch) */
    category: text('category').notNull().default('tanaman'),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    landId: uuid('land_id').references(() => lands.id),
    startDate: date('start_date').notNull(),
    targetHarvestDate: date('target_harvest_date'),
    areaHa: numeric('area_ha'),
    /** Populasi awal (bibit / ekor). */
    initialQty: numeric('initial_qty'),
    /** Tahap rantai nilai saat ini (lihat shared/stages.ts). */
    stage: text('stage').notNull().default('land'),
    /** berjalan | selesai | gagal */
    status: text('status').notNull().default('berjalan'),
    /** Kode lacak publik (QR) — acak, dibuat saat laporan traceability dibagikan. */
    traceCode: text('trace_code'),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({
    uq: uniqueIndex('uq_cycles_company_code').on(t.companyId, t.code),
    uqTrace: uniqueIndex('uq_cycles_trace_code').on(t.traceCode),
  }),
);

/** Riwayat perpindahan tahap — jejak rantai nilai per siklus. */
export const cycleStageHistory = pgTable('cycle_stage_history', {
  id: idPk(),
  companyId: companyId(),
  cycleId: uuid('cycle_id')
    .notNull()
    .references(() => cycles.id),
  fromStage: text('from_stage'),
  toStage: text('to_stage').notNull(),
  byUserId: uuid('by_user_id'),
  note: text('note'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Kegiatan budidaya harian: pemupukan, penyiraman, pengendalian hama, pakan, dst. */
export const cycleActivities = pgTable('cycle_activities', {
  id: idPk(),
  companyId: companyId(),
  cycleId: uuid('cycle_id')
    .notNull()
    .references(() => cycles.id),
  activityDate: date('activity_date').notNull(),
  /** pengolahan | penyemaian | penanaman | pemupukan | penyiraman | penyiangan | hama_penyakit | pakan | vitamin | lainnya */
  activityType: text('activity_type').notNull().default('lainnya'),
  description: text('description'),
  cost: numeric('cost').notNull().default('0'),
  /** Foto bukti kegiatan (opsional) — juga tampil di laporan traceability & halaman lacak. */
  photoUrl: text('photo_url'),
  ...timestamps,
});

/** Panen — mencatat hasil; posting otomatis menambah stok gudang. */
export const harvests = pgTable('harvests', {
  id: idPk(),
  companyId: companyId(),
  cycleId: uuid('cycle_id')
    .notNull()
    .references(() => cycles.id),
  harvestDate: date('harvest_date').notNull(),
  qty: numeric('qty').notNull(),
  unit: text('unit').notNull().default('kg'),
  /** Kelas mutu hasil sortasi: A | B | C */
  quality: text('quality'),
  warehouseId: uuid('warehouse_id'),
  note: text('note'),
  /** Foto hasil panen (opsional) — bukti visual untuk pembeli di halaman lacak. */
  photoUrl: text('photo_url'),
  ...timestamps,
});
