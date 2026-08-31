import { boolean, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';
import { lands } from './master';

/** Perangkat IoT smart farming: sensor tanah, suhu, pH, level air, stasiun cuaca. */
export const devices = pgTable(
  'devices',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** kelembapan_tanah | suhu_udara | kelembapan_udara | ph_tanah | level_air | curah_hujan */
    deviceType: text('device_type').notNull().default('kelembapan_tanah'),
    landId: uuid('land_id').references(() => lands.id),
    unit: text('unit').notNull().default('%'),
    /** Ambang normal — di luar rentang ini WUTUH AI memberi peringatan. */
    minThreshold: numeric('min_threshold'),
    maxThreshold: numeric('max_threshold'),
    /** Kunci API perangkat untuk kirim data ke POST /iot/ingest. */
    apiKey: text('api_key').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    uq: uniqueIndex('uq_devices_company_code').on(t.companyId, t.code),
    uqKey: uniqueIndex('uq_devices_api_key').on(t.apiKey),
  }),
);

/** Bacaan sensor (time series). */
export const deviceReadings = pgTable('device_readings', {
  id: idPk(),
  companyId: companyId(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.id),
  value: numeric('value').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
});
