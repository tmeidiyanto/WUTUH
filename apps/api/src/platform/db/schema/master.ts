import { boolean, numeric, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';

/** Lahan — sawah, ladang, kebun, kandang, tambak, pekarangan (tahap LAND). */
export const lands = pgTable(
  'lands',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** sawah | ladang | kebun | kandang | tambak | pekarangan */
    landUse: text('land_use').notNull().default('sawah'),
    areaHa: numeric('area_ha').notNull().default('0'),
    village: text('village'),
    soilType: text('soil_type'),
    irrigation: text('irrigation'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_lands_company_code').on(t.companyId, t.code) }),
);

/** Komoditas — padi, jagung, cabai, kopi, sapi, telur, dsb. */
export const commodities = pgTable(
  'commodities',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** pangan | hortikultura | perkebunan | ternak | perikanan | olahan */
    category: text('category').notNull().default('pangan'),
    /** kg | ton | ekor | liter | butir | ikat | karung */
    unit: text('unit').notNull().default('kg'),
    /** Perkiraan hasil per hektar (untuk prediksi panen WUTUH AI). */
    avgYieldPerHa: numeric('avg_yield_per_ha'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_commodities_company_code').on(t.companyId, t.code) }),
);
