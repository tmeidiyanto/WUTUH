import { boolean, date, numeric, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { commodities } from './master';

/** Mitra bisnis B2B: pembeli besar, pemasok, eksportir, koperasi, pengolah. */
export const partners = pgTable(
  'partners',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** pembeli | pemasok | eksportir | koperasi | pengolah */
    partnerType: text('partner_type').notNull().default('pembeli'),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    city: text('city'),
    note: text('note'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_partners_company_code').on(t.companyId, t.code) }),
);

/** Kontrak dagang B2B (WUTUH Trade). */
export const deals = pgTable(
  'deals',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    partnerId: uuid('partner_id')
      .notNull()
      .references(() => partners.id),
    commodityId: uuid('commodity_id')
      .notNull()
      .references(() => commodities.id),
    qty: numeric('qty').notNull(),
    unit: text('unit').notNull().default('kg'),
    pricePerUnit: numeric('price_per_unit').notNull(),
    totalValue: numeric('total_value').notNull(),
    deliveryTerms: text('delivery_terms'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    /** draf | negosiasi | kontrak | berjalan | selesai | batal */
    status: text('status').notNull().default('draf'),
    note: text('note'),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_deals_company_code').on(t.companyId, t.code) }),
);
