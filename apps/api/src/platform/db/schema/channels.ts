import { boolean, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';

/**
 * Saluran komunikasi per usaha (WhatsApp sekarang; Email/Telegram menyusul).
 * config per saluran (WA: { gatewayUrl, token }), events = daftar event yang
 * dikirim lewat saluran ini. Tanpa baris → fallback ke env WA_GATEWAY_* (global).
 */
export const commChannels = pgTable(
  'comm_channels',
  {
    id: idPk(),
    companyId: companyId(),
    /** whatsapp | email | telegram */
    channel: text('channel').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    config: jsonb('config').$type<Record<string, string>>().notNull().default({}),
    /** 'order_status_to_buyer' | 'new_order_to_seller' */
    events: jsonb('events').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => ({ uq: uniqueIndex('uq_comm_channels_company_channel').on(t.companyId, t.channel) }),
);
