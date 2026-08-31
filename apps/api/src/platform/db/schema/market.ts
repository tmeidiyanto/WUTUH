import { date, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities } from './master';
import { cycles } from './farm';

/** Harga pasar acuan per komoditas per wilayah (tren untuk WUTUH AI). */
export const marketPrices = pgTable('market_prices', {
  id: idPk(),
  companyId: companyId(),
  commodityId: uuid('commodity_id')
    .notNull()
    .references(() => commodities.id),
  region: text('region').notNull().default('Nasional'),
  priceDate: date('price_date').notNull(),
  pricePerUnit: numeric('price_per_unit').notNull(),
  unit: text('unit').notNull().default('kg'),
  source: text('source'),
  ...timestamps,
});

/** Lapak — produk yang dijual di WUTUH Market (tahap MARKET). */
export const listings = pgTable(
  'listings',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    title: text('title').notNull(),
    qty: numeric('qty').notNull(),
    unit: text('unit').notNull().default('kg'),
    pricePerUnit: numeric('price_per_unit').notNull(),
    minOrder: numeric('min_order'),
    description: text('description'),
    /** Foto SAMPUL = foto pertama galeri listing_photos (denormalisasi agar kartu tanpa join). */
    photoUrl: text('photo_url'),
    /** Siklus asal barang lapak — pesanan Pasar WUTUH mewarisinya (traceability sampai pelanggan). */
    cycleId: uuid('cycle_id').references(() => cycles.id),
    /** aktif | habis | nonaktif */
    status: text('status').notNull().default('aktif'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_listings_company_code').on(t.companyId, t.code) }),
);

/** Galeri foto lapak (maks. 5 per lapak; sort_order 0 = sampul). */
export const listingPhotos = pgTable('listing_photos', {
  id: idPk(),
  companyId: companyId(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

/** Pesanan masuk dari pembeli. */
export const orders = pgTable(
  'orders',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    listingId: uuid('listing_id').references(() => listings.id),
    buyerName: text('buyer_name').notNull(),
    buyerPhone: text('buyer_phone'),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    qty: numeric('qty').notNull(),
    unit: text('unit').notNull().default('kg'),
    pricePerUnit: numeric('price_per_unit').notNull(),
    total: numeric('total').notNull(),
    orderDate: date('order_date').notNull(),
    /** baru | dikonfirmasi | dikirim | selesai | batal */
    status: text('status').notNull().default('baru'),
    /** qris | tunai — cara bayar yang dipilih pembeli. */
    paymentMethod: text('payment_method').notNull().default('tunai'),
    /** Terisi saat penjual menandai pesanan sudah dibayar (otomatis saat 'selesai'). */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Gudang sumber barang — stok berkurang saat status 'dikirim'. */
    warehouseId: uuid('warehouse_id'),
    /** Siklus asal hasil (opsional) — pemasukan saat 'selesai' ditautkan ke siklus ini (untung/rugi per siklus). */
    cycleId: uuid('cycle_id').references(() => cycles.id),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_orders_company_code').on(t.companyId, t.code) }),
);
