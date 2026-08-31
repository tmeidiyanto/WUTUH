import * as schema from '../db/schema';
import type { Tx } from '../db/db.types';

/** Komoditas awal supaya usaha baru langsung bisa jalan. */
const DEFAULT_COMMODITIES: Array<{
  code: string;
  name: string;
  category: string;
  unit: string;
  avgYieldPerHa?: string;
}> = [
  { code: 'PADI', name: 'Padi (GKP)', category: 'pangan', unit: 'kg', avgYieldPerHa: '5200' },
  { code: 'JAGUNG', name: 'Jagung Pipil', category: 'pangan', unit: 'kg', avgYieldPerHa: '5500' },
  { code: 'CABAI', name: 'Cabai Merah', category: 'hortikultura', unit: 'kg', avgYieldPerHa: '8000' },
  { code: 'BAWANG', name: 'Bawang Merah', category: 'hortikultura', unit: 'kg', avgYieldPerHa: '9500' },
  { code: 'KOPI', name: 'Kopi Arabika', category: 'perkebunan', unit: 'kg', avgYieldPerHa: '800' },
  { code: 'SAPI', name: 'Sapi Potong', category: 'ternak', unit: 'ekor' },
  { code: 'AYAM', name: 'Ayam Broiler', category: 'ternak', unit: 'ekor' },
  { code: 'TELUR', name: 'Telur Ayam', category: 'ternak', unit: 'kg' },
  { code: 'SUSU', name: 'Susu Sapi Segar', category: 'ternak', unit: 'liter' },
];

/** Penomoran dokumen per jenis. */
const NUMBERING: Array<{ docType: string; prefix: string }> = [
  { docType: 'cycle', prefix: 'SKL-' },
  { docType: 'order', prefix: 'PSN-' },
  { docType: 'deal', prefix: 'KTR-' },
  { docType: 'export', prefix: 'EKS-' },
  { docType: 'delivery', prefix: 'KRM-' },
  { docType: 'listing', prefix: 'LPK-' },
];

/**
 * Provisioning default untuk company baru: role Admin & Anggota, penomoran
 * dokumen, komoditas awal, dan satu gudang utama. Dipanggil di dalam transaksi
 * (tx) yang sudah ber-konteks company (RLS aktif).
 */
export async function provisionCompanyDefaults(tx: Tx, companyId: string) {
  const [adminRole] = await tx
    .insert(schema.roles)
    .values({ companyId, code: 'ADMIN', name: 'Admin Usaha', permissions: ['*'] })
    .returning();

  await tx.insert(schema.roles).values({
    companyId,
    code: 'ANGGOTA',
    name: 'Anggota',
    permissions: [
      'farm.*', 'ranch.*', 'supply.*', 'market.read', 'trade.read', 'export.read',
      'finance.read', 'ai.read', 'iot.*', 'master.read',
    ],
  });

  await tx
    .insert(schema.numberingSequences)
    .values(NUMBERING.map((n) => ({ companyId, docType: n.docType, prefix: n.prefix })));

  await tx
    .insert(schema.commodities)
    .values(DEFAULT_COMMODITIES.map((c) => ({ companyId, ...c })));

  await tx
    .insert(schema.warehouses)
    .values({ companyId, code: 'GDG-01', name: 'Gudang Utama' });

  return { adminRoleId: adminRole.id };
}
