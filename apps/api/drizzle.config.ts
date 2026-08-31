import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Satu sumber env: file .env di root monorepo (cwd = apps/api saat skrip jalan).
config({ path: '../../.env' });

// Skema dibuat/di-push memakai koneksi ADMIN (owner), bukan koneksi app ber-RLS.
const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!adminUrl) throw new Error('DATABASE_ADMIN_URL / DATABASE_URL belum di-set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: adminUrl },
  verbose: true,
  strict: false,
});
