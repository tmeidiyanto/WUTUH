import { boolean, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { idPk, companyId, timestamps } from './_common';

/**
 * Daftar usaha tani (company). Tabel ini TIDAK ber-RLS per-company.
 * Satu company = satu petani / kelompok tani / koperasi / perusahaan agribisnis.
 */
export const companies = pgTable('companies', {
  id: idPk(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  /** petani | kelompok_tani | koperasi | perusahaan */
  businessType: text('business_type').notNull().default('petani'),
  province: text('province'),
  regency: text('regency'),
  phone: text('phone'),
  /** Gambar kode QRIS usaha (diunggah di Pengaturan > Pembayaran) — dipakai checkout Pasar WUTUH. */
  qrisUrl: text('qris_url'),
  /** Kode wilayah BMKG tingkat kelurahan/desa (adm4, cth. 34.04.07.2003) untuk prakiraan cuaca. */
  weatherCode: text('weather_code'),
  baseCurrency: text('base_currency').notNull().default('IDR'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

/** Role per company; permissions array string granular ('farm.write', dll) atau '*'. */
export const roles = pgTable(
  'roles',
  {
    id: idPk(),
    companyId: companyId(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => ({ uqRoleCode: uniqueIndex('uq_roles_company_code').on(t.companyId, t.code) }),
);

/**
 * Pengguna. Email unik GLOBAL (bukan per-company) supaya login cukup
 * email + password tanpa kode usaha — sederhana untuk petani.
 */
export const users = pgTable(
  'users',
  {
    id: idPk(),
    companyId: companyId(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    passwordHash: text('password_hash').notNull(),
    roleId: uuid('role_id').references(() => roles.id),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({ uqUserEmail: uniqueIndex('uq_users_email').on(t.email) }),
);
