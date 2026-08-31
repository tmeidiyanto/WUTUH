import { date, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities, lands } from './master';
import { cycles } from './farm';

/** Ternak individual (sapi, kambing, dsb.) — bertag; unggas dikelola per siklus/batch. */
export const livestock = pgTable(
  'livestock',
  {
    id: idPk(),
    companyId: companyId(),
    tag: text('tag').notNull(),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    /** Kandang (lahan ber-jenis 'kandang'). */
    landId: uuid('land_id').references(() => lands.id),
    cycleId: uuid('cycle_id').references(() => cycles.id),
    /** jantan | betina */
    sex: text('sex').notNull().default('betina'),
    birthDate: date('birth_date'),
    weightKg: numeric('weight_kg'),
    /** sehat | sakit | bunting | dijual | mati */
    status: text('status').notNull().default('sehat'),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_livestock_company_tag').on(t.companyId, t.tag) }),
);

/** Produksi harian ternak: susu (liter), telur (butir), dsb. */
export const livestockProduction = pgTable('livestock_production', {
  id: idPk(),
  companyId: companyId(),
  productionDate: date('production_date').notNull(),
  /** Kandang asal (opsional) atau ternak individual (opsional). */
  landId: uuid('land_id').references(() => lands.id),
  livestockId: uuid('livestock_id').references(() => livestock.id),
  /** Produk yang dihasilkan (telur, susu, ...). */
  commodityId: uuid('commodity_id')
    .notNull()
    .references(() => commodities.id),
  qty: numeric('qty').notNull(),
  unit: text('unit').notNull().default('kg'),
  /** Bila diisi, hasil produksi otomatis menambah stok gudang ini. */
  warehouseId: uuid('warehouse_id'),
  note: text('note'),
  ...timestamps,
});

/** Catatan kesehatan: vaksinasi, pengobatan, pemeriksaan, vitamin. */
export const livestockHealth = pgTable('livestock_health', {
  id: idPk(),
  companyId: companyId(),
  healthDate: date('health_date').notNull(),
  livestockId: uuid('livestock_id')
    .notNull()
    .references(() => livestock.id),
  /** vaksinasi | pengobatan | pemeriksaan | vitamin */
  action: text('action').notNull().default('pemeriksaan'),
  medicine: text('medicine'),
  cost: numeric('cost').notNull().default('0'),
  /** Jadwal tindak lanjut (vaksin berikutnya, dsb.) — dipakai WUTUH AI. */
  nextDueDate: date('next_due_date'),
  note: text('note'),
  ...timestamps,
});
