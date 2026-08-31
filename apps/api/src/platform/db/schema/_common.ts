import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** Kolom id uuid (PK) dengan default gen_random_uuid() — butuh PostgreSQL 13+. */
export const idPk = () => uuid('id').primaryKey().defaultRandom();

/**
 * company_id — ada di SEMUA tabel ber-company (di WUTUH: "usaha tani").
 * Sengaja BUKAN FK (fleksibilitas partisi/performa); isolasi dijamin oleh
 * Row-Level Security, bukan FK.
 */
export const companyId = () => uuid('company_id').notNull();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
