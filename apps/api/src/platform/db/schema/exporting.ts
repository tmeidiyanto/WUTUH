import { date, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities } from './master';

/** Ceklis dokumen ekspor. */
export interface ExportDocs {
  invoice: boolean;
  packingList: boolean;
  coo: boolean; // Certificate of Origin
  phytosanitary: boolean;
  billOfLading: boolean;
}

/** Pengiriman ekspor (WUTUH Export — tahap EXPORT). */
export const exportShipments = pgTable(
  'export_shipments',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    destinationCountry: text('destination_country').notNull(),
    destinationPort: text('destination_port'),
    buyerName: text('buyer_name'),
    qty: numeric('qty').notNull(),
    unit: text('unit').notNull().default('kg'),
    valueAmount: numeric('value_amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    etd: date('etd'),
    eta: date('eta'),
    /** persiapan | dokumen | pengapalan | tiba | selesai */
    status: text('status').notNull().default('persiapan'),
    docs: jsonb('docs')
      .$type<ExportDocs>()
      .notNull()
      .default({ invoice: false, packingList: false, coo: false, phytosanitary: false, billOfLading: false }),
    warehouseId: uuid('warehouse_id'),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_export_company_code').on(t.companyId, t.code) }),
);
