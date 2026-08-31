import { boolean, date, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities } from './master';
import { cycles } from './farm';

/** Gudang penyimpanan hasil (tahap WAREHOUSE). */
export const warehouses = pgTable(
  'warehouses',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    capacityKg: numeric('capacity_kg'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_warehouses_company_code').on(t.companyId, t.code) }),
);

/** Saldo stok per gudang per komoditas (di-update oleh setiap movement). */
export const stockBalances = pgTable(
  'stock_balances',
  {
    id: idPk(),
    companyId: companyId(),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    qty: numeric('qty').notNull().default('0'),
    unit: text('unit').notNull().default('kg'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_stock_wh_commodity').on(t.companyId, t.warehouseId, t.commodityId) }),
);

/** Kartu stok — setiap mutasi masuk/keluar tercatat dengan referensi sumbernya. */
export const stockMovements = pgTable('stock_movements', {
  id: idPk(),
  companyId: companyId(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id),
  commodityId: uuid('commodity_id')
    .notNull()
    .references(() => commodities.id),
  /** masuk | keluar */
  direction: text('direction').notNull(),
  qty: numeric('qty').notNull(),
  unit: text('unit').notNull().default('kg'),
  /** panen | produksi_ternak | pesanan | ekspor | kirim | penyesuaian */
  refType: text('ref_type').notNull().default('penyesuaian'),
  refId: uuid('ref_id'),
  /** Siklus produksi ASAL — wajib untuk penyesuaian masuk; otomatis untuk panen/produksi ternak. */
  cycleId: uuid('cycle_id').references(() => cycles.id),
  movementDate: date('movement_date').notNull(),
  note: text('note'),
  ...timestamps,
});

/** Pengiriman / logistik (tahap LOGISTICS) — internal, pesanan, maupun ekspor. */
export const deliveries = pgTable(
  'deliveries',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    deliveryDate: date('delivery_date').notNull(),
    origin: text('origin').notNull(),
    destination: text('destination').notNull(),
    commodityId: uuid('commodity_id').references(() => commodities.id),
    qty: numeric('qty'),
    unit: text('unit'),
    vehicle: text('vehicle'),
    driverName: text('driver_name'),
    driverPhone: text('driver_phone'),
    cost: numeric('cost').notNull().default('0'),
    /** dijadwalkan | dimuat | perjalanan | tiba | selesai */
    status: text('status').notNull().default('dijadwalkan'),
    /** pesanan | ekspor | internal */
    refType: text('ref_type').notNull().default('internal'),
    refId: uuid('ref_id'),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_deliveries_company_code').on(t.companyId, t.code) }),
);
