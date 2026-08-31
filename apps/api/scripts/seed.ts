import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/platform/db/schema';

config({ path: '../../.env' });

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

/** Seed via koneksi ADMIN (superuser → bypass RLS). Idempotent: skip bila TANIMAJU sudah ada. */
async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_ADMIN_URL / DATABASE_URL belum di-set');
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  const [existing] = await db.select().from(schema.companies).where(eq(schema.companies.code, 'TANIMAJU'));
  if (existing) {
    console.log('Company TANIMAJU sudah ada — seed dilewati (drop DB untuk seed ulang).');
    await pool.end();
    return;
  }

  // ===== 1) Usaha + role + user =====
  const [company] = await db
    .insert(schema.companies)
    .values({
      code: 'TANIMAJU',
      name: 'Kelompok Tani Maju Sejahtera',
      businessType: 'kelompok_tani',
      province: 'Jawa Timur',
      regency: 'Kab. Malang',
      phone: '0812-3456-7890',
    })
    .returning();
  const cid = company.id;

  const [adminRole] = await db
    .insert(schema.roles)
    .values({ companyId: cid, code: 'ADMIN', name: 'Admin Usaha', permissions: ['*'] })
    .returning();
  const [memberRole] = await db
    .insert(schema.roles)
    .values({
      companyId: cid,
      code: 'ANGGOTA',
      name: 'Anggota',
      permissions: [
        'farm.*', 'ranch.*', 'supply.*', 'market.read', 'trade.read', 'export.read',
        'finance.read', 'ai.read', 'iot.*', 'master.read',
      ],
    })
    .returning();

  await db.insert(schema.users).values([
    {
      companyId: cid,
      email: 'petani@demo.com',
      fullName: 'Pak Budi Santoso',
      phone: '0812-3456-7890',
      passwordHash: await bcrypt.hash('petani123', 10),
      roleId: adminRole.id,
    },
    {
      companyId: cid,
      email: 'anggota@demo.com',
      fullName: 'Siti Rahayu',
      phone: '0813-1111-2222',
      passwordHash: await bcrypt.hash('anggota123', 10),
      roleId: memberRole.id,
    },
  ]);

  // ===== 2) Komoditas =====
  const commodityRows = await db
    .insert(schema.commodities)
    .values([
      { companyId: cid, code: 'PADI', name: 'Padi (GKP)', category: 'pangan', unit: 'kg', avgYieldPerHa: '5200' },
      { companyId: cid, code: 'JAGUNG', name: 'Jagung Pipil', category: 'pangan', unit: 'kg', avgYieldPerHa: '5500' },
      { companyId: cid, code: 'CABAI', name: 'Cabai Merah', category: 'hortikultura', unit: 'kg', avgYieldPerHa: '8000' },
      { companyId: cid, code: 'BAWANG', name: 'Bawang Merah', category: 'hortikultura', unit: 'kg', avgYieldPerHa: '9500' },
      { companyId: cid, code: 'KOPI', name: 'Kopi Arabika', category: 'perkebunan', unit: 'kg', avgYieldPerHa: '800' },
      { companyId: cid, code: 'SAPI', name: 'Sapi Potong', category: 'ternak', unit: 'ekor' },
      { companyId: cid, code: 'AYAM', name: 'Ayam Broiler', category: 'ternak', unit: 'ekor' },
      { companyId: cid, code: 'TELUR', name: 'Telur Ayam', category: 'ternak', unit: 'kg' },
      { companyId: cid, code: 'SUSU', name: 'Susu Sapi Segar', category: 'ternak', unit: 'liter' },
      { companyId: cid, code: 'BERAS', name: 'Beras Premium', category: 'olahan', unit: 'kg' },
    ])
    .returning();
  const C = Object.fromEntries(commodityRows.map((c) => [c.code, c]));

  // ===== 3) Lahan =====
  const landRows = await db
    .insert(schema.lands)
    .values([
      { companyId: cid, code: 'LHN-A', name: 'Sawah Blok A', landUse: 'sawah', areaHa: '1.5', village: 'Desa Sumberejo', irrigation: 'Irigasi teknis' },
      { companyId: cid, code: 'LHN-B', name: 'Sawah Blok B', landUse: 'sawah', areaHa: '1.2', village: 'Desa Sumberejo', irrigation: 'Irigasi teknis' },
      { companyId: cid, code: 'LHN-C', name: 'Ladang Jagung C', landUse: 'ladang', areaHa: '2.0', village: 'Desa Wringinanom', soilType: 'Latosol' },
      { companyId: cid, code: 'LHN-D', name: 'Kebun Kopi D (Lereng)', landUse: 'kebun', areaHa: '3.0', village: 'Desa Ngadas', soilType: 'Andosol' },
      { companyId: cid, code: 'KDG-E', name: 'Kandang Sapi E', landUse: 'kandang', areaHa: '0.2', village: 'Desa Sumberejo' },
      { companyId: cid, code: 'KDG-F', name: 'Kandang Ayam Broiler F', landUse: 'kandang', areaHa: '0.1', village: 'Desa Sumberejo' },
      { companyId: cid, code: 'KDG-G', name: 'Kandang Ayam Petelur G', landUse: 'kandang', areaHa: '0.1', village: 'Desa Sumberejo' },
    ])
    .returning();
  const L = Object.fromEntries(landRows.map((l) => [l.code, l]));

  // ===== 4) Gudang =====
  const whRows = await db
    .insert(schema.warehouses)
    .values([
      { companyId: cid, code: 'GDG-01', name: 'Gudang Utama', address: 'Desa Sumberejo', capacityKg: '20000' },
      { companyId: cid, code: 'GDG-02', name: 'Gudang Kopi', address: 'Desa Ngadas', capacityKg: '8000' },
    ])
    .returning();
  const W = Object.fromEntries(whRows.map((w) => [w.code, w]));

  // ===== 5) Siklus produksi (menyebar di sepanjang rantai nilai) =====
  const cycleRows = await db
    .insert(schema.cycles)
    .values([
      { companyId: cid, code: 'SKL-0001', name: 'Padi MT I — Blok A', category: 'tanaman', commodityId: C.PADI.id, landId: L['LHN-A'].id, startDate: day(-60), targetHarvestDate: day(30), areaHa: '1.5', stage: 'cultivation' },
      { companyId: cid, code: 'SKL-0002', name: 'Padi MT I — Blok B', category: 'tanaman', commodityId: C.PADI.id, landId: L['LHN-B'].id, startDate: day(-75), targetHarvestDate: day(15), areaHa: '1.2', stage: 'monitoring' },
      { companyId: cid, code: 'SKL-0003', name: 'Jagung MT I — Ladang C', category: 'tanaman', commodityId: C.JAGUNG.id, landId: L['LHN-C'].id, startDate: day(-10), targetHarvestDate: day(80), areaHa: '2.0', stage: 'planting' },
      { companyId: cid, code: 'SKL-0004', name: 'Kopi Panen 2026', category: 'kebun', commodityId: C.KOPI.id, landId: L['LHN-D'].id, startDate: day(-120), targetHarvestDate: day(-5), areaHa: '3.0', stage: 'warehouse' },
      { companyId: cid, code: 'SKL-0005', name: 'Penggemukan Sapi Angkatan 2', category: 'ternak', commodityId: C.SAPI.id, landId: L['KDG-E'].id, startDate: day(-90), initialQty: '8', stage: 'cultivation' },
      { companyId: cid, code: 'SKL-0006', name: 'Ayam Broiler Batch 12', category: 'ternak', commodityId: C.AYAM.id, landId: L['KDG-F'].id, startDate: day(-20), targetHarvestDate: day(15), initialQty: '500', stage: 'monitoring' },
      { companyId: cid, code: 'SKL-0007', name: 'Cabai MT II (Selesai)', category: 'tanaman', commodityId: C.CABAI.id, landId: L['LHN-C'].id, startDate: day(-180), targetHarvestDate: day(-60), areaHa: '1.0', stage: 'customer', status: 'selesai' },
      { companyId: cid, code: 'SKL-0008', name: 'Bawang Merah MT II', category: 'tanaman', commodityId: C.BAWANG.id, landId: L['LHN-B'].id, startDate: day(-2), targetHarvestDate: day(70), areaHa: '0.8', stage: 'planning' },
    ])
    .returning();
  const S = Object.fromEntries(cycleRows.map((s) => [s.code, s]));

  // Riwayat tahap (contoh perjalanan rantai).
  const hist = (code: string, stages: string[], startOffset: number) =>
    stages.map((st, i) => ({
      companyId: cid,
      cycleId: S[code].id,
      fromStage: i === 0 ? null : stages[i - 1],
      toStage: st,
      at: new Date(Date.now() + (startOffset + i * 7) * 24 * 3600 * 1000),
      note: i === 0 ? 'Siklus dibuat' : null,
    }));
  await db.insert(schema.cycleStageHistory).values([
    ...hist('SKL-0001', ['land', 'planning', 'planting', 'cultivation'], -60),
    ...hist('SKL-0002', ['land', 'planning', 'planting', 'cultivation', 'monitoring'], -75),
    ...hist('SKL-0003', ['land', 'planning', 'planting'], -10),
    ...hist('SKL-0004', ['land', 'planning', 'planting', 'cultivation', 'monitoring', 'harvest', 'processing', 'quality', 'warehouse'], -120),
    ...hist('SKL-0005', ['land', 'planning', 'planting', 'cultivation'], -90),
    ...hist('SKL-0006', ['land', 'planning', 'planting', 'cultivation', 'monitoring'], -20),
    ...hist('SKL-0007', ['land', 'planning', 'planting', 'cultivation', 'monitoring', 'harvest', 'processing', 'quality', 'warehouse', 'market', 'logistics', 'export', 'customer'], -180),
    ...hist('SKL-0008', ['land', 'planning'], -2),
  ]);

  // ===== 6) Kegiatan budidaya + pengeluaran otomatis =====
  const acts = [
    { code: 'SKL-0001', d: -58, t: 'pengolahan', desc: 'Bajak & garu sawah', cost: 500000 },
    { code: 'SKL-0001', d: -55, t: 'penyemaian', desc: 'Semai benih Ciherang 25 kg', cost: 200000 },
    { code: 'SKL-0001', d: -50, t: 'penanaman', desc: 'Tanam serempak, jarak 25cm', cost: 750000 },
    { code: 'SKL-0001', d: -30, t: 'pemupukan', desc: 'Urea 100kg + NPK 50kg', cost: 600000 },
    { code: 'SKL-0001', d: -20, t: 'penyiraman', desc: 'Atur air macak-macak', cost: 0 },
    { code: 'SKL-0001', d: -10, t: 'hama_penyakit', desc: 'Semprot wereng batang coklat', cost: 350000 },
    { code: 'SKL-0002', d: -40, t: 'pemupukan', desc: 'Pupuk susulan NPK', cost: 450000 },
    { code: 'SKL-0003', d: -8, t: 'penanaman', desc: 'Tanam benih hibrida BISI-18', cost: 900000 },
    { code: 'SKL-0005', d: -7, t: 'pakan', desc: 'Konsentrat + hijauan 1 minggu', cost: 1200000 },
    { code: 'SKL-0006', d: -5, t: 'pakan', desc: 'Pakan starter 20 sak', cost: 2400000 },
  ];
  for (const a of acts) {
    const [act] = await db
      .insert(schema.cycleActivities)
      .values({
        companyId: cid,
        cycleId: S[a.code].id,
        activityDate: day(a.d),
        activityType: a.t,
        description: a.desc,
        cost: String(a.cost),
      })
      .returning();
    if (a.cost > 0) {
      await db.insert(schema.finTransactions).values({
        companyId: cid,
        txDate: day(a.d),
        kind: 'keluar',
        category: a.t === 'pakan' ? 'pakan' : a.t === 'pemupukan' ? 'pembelian_input' : 'lainnya',
        amount: String(a.cost),
        cycleId: S[a.code].id,
        refType: 'kegiatan',
        refId: act.id,
        note: `Kegiatan ${a.t}: ${a.desc}`,
      });
    }
  }

  // ===== 7) Panen kopi → stok gudang =====
  const addStock = async (whId: string, commodityId: string, qty: number, unit: string, refType: string, refId: string | null, d: number, note: string) => {
    await db.insert(schema.stockMovements).values({
      companyId: cid, warehouseId: whId, commodityId, direction: 'masuk',
      qty: String(qty), unit, refType, refId, movementDate: day(d), note,
    });
  };
  const issueStock = async (whId: string, commodityId: string, qty: number, unit: string, refType: string, refId: string | null, d: number, note: string) => {
    await db.insert(schema.stockMovements).values({
      companyId: cid, warehouseId: whId, commodityId, direction: 'keluar',
      qty: String(qty), unit, refType, refId, movementDate: day(d), note,
    });
  };

  const [hv1] = await db.insert(schema.harvests).values({
    companyId: cid, cycleId: S['SKL-0004'].id, harvestDate: day(-15), qty: '800', unit: 'kg', quality: 'A', warehouseId: W['GDG-02'].id, note: 'Petik merah gelombang 1',
  }).returning();
  await addStock(W['GDG-02'].id, C.KOPI.id, 800, 'kg', 'panen', hv1.id, -15, 'Panen SKL-0004 gel. 1');

  const [hv2] = await db.insert(schema.harvests).values({
    companyId: cid, cycleId: S['SKL-0004'].id, harvestDate: day(-8), qty: '650', unit: 'kg', quality: 'A', warehouseId: W['GDG-02'].id, note: 'Petik merah gelombang 2',
  }).returning();
  await addStock(W['GDG-02'].id, C.KOPI.id, 650, 'kg', 'panen', hv2.id, -8, 'Panen SKL-0004 gel. 2');

  const [hv3] = await db.insert(schema.harvests).values({
    companyId: cid, cycleId: S['SKL-0007'].id, harvestDate: day(-70), qty: '1200', unit: 'kg', quality: 'B', warehouseId: W['GDG-01'].id, note: 'Panen cabai akhir musim',
  }).returning();
  await addStock(W['GDG-01'].id, C.CABAI.id, 1200, 'kg', 'panen', hv3.id, -70, 'Panen SKL-0007');
  await issueStock(W['GDG-01'].id, C.CABAI.id, 1050, 'kg', 'pesanan', null, -55, 'Penjualan cabai borongan');

  // Produksi telur & susu → stok GDG-01
  for (let i = 6; i >= 0; i--) {
    const [rec] = await db.insert(schema.livestockProduction).values({
      companyId: cid, productionDate: day(-i), landId: L['KDG-G'].id, commodityId: C.TELUR.id,
      qty: String(42 + (i % 3) * 3), unit: 'kg', warehouseId: W['GDG-01'].id, note: 'Produksi harian kandang G',
    }).returning();
    await addStock(W['GDG-01'].id, C.TELUR.id, Number(rec.qty), 'kg', 'produksi_ternak', rec.id, -i, 'Telur harian');
  }

  // ===== 8) Saldo stok (rekap dari movement di atas) =====
  const telurTotal = [0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + 42 + (i % 3) * 3, 0);
  await db.insert(schema.stockBalances).values([
    { companyId: cid, warehouseId: W['GDG-02'].id, commodityId: C.KOPI.id, qty: '1450', unit: 'kg' },
    { companyId: cid, warehouseId: W['GDG-01'].id, commodityId: C.CABAI.id, qty: '150', unit: 'kg' },
    { companyId: cid, warehouseId: W['GDG-01'].id, commodityId: C.TELUR.id, qty: String(telurTotal), unit: 'kg' },
  ]);

  // ===== 9) Ternak & kesehatan =====
  const cattle = await db
    .insert(schema.livestock)
    .values(
      Array.from({ length: 8 }, (_, i) => ({
        companyId: cid,
        tag: `SP-00${i + 1}`,
        commodityId: C.SAPI.id,
        landId: L['KDG-E'].id,
        cycleId: S['SKL-0005'].id,
        sex: i < 5 ? 'jantan' : 'betina',
        birthDate: day(-400 - i * 30),
        weightKg: String(250 + i * 22),
        status: i === 3 ? 'sakit' : 'sehat',
      })),
    )
    .returning();

  await db.insert(schema.livestockHealth).values([
    { companyId: cid, healthDate: day(-30), livestockId: cattle[0].id, action: 'vaksinasi', medicine: 'Vaksin PMK', cost: '150000', nextDueDate: day(3), note: 'Dosis 1 — booster wajib' },
    { companyId: cid, healthDate: day(-30), livestockId: cattle[1].id, action: 'vaksinasi', medicine: 'Vaksin PMK', cost: '150000', nextDueDate: day(5) },
    { companyId: cid, healthDate: day(-2), livestockId: cattle[3].id, action: 'pengobatan', medicine: 'Antibiotik + vitamin', cost: '250000', note: 'Nafsu makan turun' },
  ]);
  for (const h of [{ d: -30, c: 300000 }, { d: -2, c: 250000 }]) {
    await db.insert(schema.finTransactions).values({
      companyId: cid, txDate: day(h.d), kind: 'keluar', category: 'obat', amount: String(h.c),
      cycleId: S['SKL-0005'].id, refType: 'kesehatan', note: 'Biaya kesehatan ternak',
    });
  }

  // Produksi susu 3 hari terakhir dari 3 sapi betina.
  for (let i = 2; i >= 0; i--) {
    await db.insert(schema.livestockProduction).values({
      companyId: cid, productionDate: day(-i), livestockId: cattle[5].id, commodityId: C.SUSU.id,
      qty: '14', unit: 'liter', note: 'Perahan pagi+sore',
    });
  }

  // ===== 10) Harga pasar (8 minggu, beberapa komoditas) =====
  const priceSeries: Array<[string, string, number[]]> = [
    ['PADI', 'Jawa Timur', [6300, 6350, 6400, 6450, 6500, 6600, 6750, 6900]],
    ['CABAI', 'Jawa Timur', [40000, 39500, 41000, 42500, 43000, 44000, 46000, 48500]],
    ['BAWANG', 'Jawa Timur', [30000, 29500, 29000, 28000, 27500, 26500, 25500, 24000]],
    ['KOPI', 'Nasional', [85000, 86000, 87500, 88000, 90000, 91500, 93000, 95000]],
    ['JAGUNG', 'Jawa Timur', [5200, 5250, 5200, 5300, 5250, 5300, 5350, 5400]],
    ['TELUR', 'Jawa Timur', [27000, 27500, 27000, 28000, 28500, 28000, 28500, 29000]],
  ];
  for (const [code, region, series] of priceSeries) {
    for (let i = 0; i < series.length; i++) {
      await db.insert(schema.marketPrices).values({
        companyId: cid,
        commodityId: C[code].id,
        region,
        priceDate: day(-7 * (series.length - 1 - i)),
        pricePerUnit: String(series[i]),
        unit: C[code].unit,
        source: 'Pasar induk',
      });
    }
  }

  // ===== 11) Lapak & pesanan =====
  const [lst1] = await db.insert(schema.listings).values({
    companyId: cid, code: 'LPK-0001', commodityId: C.KOPI.id, title: 'Kopi Arabika Petik Merah — Grade A',
    qty: '1000', unit: 'kg', pricePerUnit: '95000', minOrder: '25',
    description: 'Kopi arabika lereng Bromo, proses full-washed, siap sangrai.', status: 'aktif',
  }).returning();
  await db.insert(schema.listings).values({
    companyId: cid, code: 'LPK-0002', commodityId: C.TELUR.id, title: 'Telur Ayam Segar Harian',
    qty: '100', unit: 'kg', pricePerUnit: '29000', minOrder: '5',
    description: 'Telur segar dari kandang sendiri, dikirim hari yang sama.', status: 'aktif',
  });

  const [ord1] = await db.insert(schema.orders).values({
    companyId: cid, code: 'PSN-0001', listingId: lst1.id, buyerName: 'Kedai Kopi Nusantara', buyerPhone: '0812-9999-0001',
    commodityId: C.KOPI.id, qty: '200', unit: 'kg', pricePerUnit: '95000', total: '19000000',
    orderDate: day(-6), status: 'selesai', warehouseId: W['GDG-02'].id,
  }).returning();
  await issueStock(W['GDG-02'].id, C.KOPI.id, 200, 'kg', 'pesanan', ord1.id, -4, 'Kirim PSN-0001');
  // saldo kopi setelah penjualan 200kg
  await db
    .update(schema.stockBalances)
    .set({ qty: '1250' })
    .where(eq(schema.stockBalances.commodityId, C.KOPI.id));
  await db.insert(schema.finTransactions).values({
    companyId: cid, txDate: day(-3), kind: 'masuk', category: 'penjualan', amount: '19000000',
    refType: 'pesanan', refId: ord1.id, note: 'Penjualan PSN-0001 — Kedai Kopi Nusantara',
  });

  const [ord2] = await db.insert(schema.orders).values({
    companyId: cid, code: 'PSN-0002', listingId: lst1.id, buyerName: 'Roastery Malang Raya', buyerPhone: '0813-8888-0002',
    commodityId: C.KOPI.id, qty: '100', unit: 'kg', pricePerUnit: '95000', total: '9500000',
    orderDate: day(-3), status: 'baru', warehouseId: W['GDG-02'].id,
  }).returning();
  // createdAt mundur supaya insight "belum dikonfirmasi" muncul.
  await db
    .update(schema.orders)
    .set({ createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) })
    .where(eq(schema.orders.id, ord2.id));

  await db.insert(schema.orders).values({
    companyId: cid, code: 'PSN-0003', buyerName: 'Ibu Sari (Pasar Gadang)', buyerPhone: '0812-7777-0003',
    commodityId: C.TELUR.id, qty: '20', unit: 'kg', pricePerUnit: '29000', total: '580000',
    orderDate: day(-1), status: 'dikonfirmasi', warehouseId: W['GDG-01'].id,
  });

  // ===== 12) Mitra & kontrak B2B =====
  const partnersRows = await db
    .insert(schema.partners)
    .values([
      { companyId: cid, code: 'MTR-001', name: 'PT Agro Ekspor Nusantara', partnerType: 'eksportir', contactName: 'Rina Wijaya', phone: '021-555-0101', email: 'rina@agroekspor.co.id', city: 'Surabaya' },
      { companyId: cid, code: 'MTR-002', name: 'Koperasi Tani Makmur', partnerType: 'koperasi', contactName: 'H. Ahmad', phone: '0341-555-0102', city: 'Malang' },
      { companyId: cid, code: 'MTR-003', name: 'CV Pangan Sejahtera', partnerType: 'pembeli', contactName: 'Budi Hartono', phone: '031-555-0103', city: 'Sidoarjo' },
    ])
    .returning();

  await db.insert(schema.deals).values([
    {
      companyId: cid, code: 'KTR-0001', partnerId: partnersRows[0].id, commodityId: C.KOPI.id,
      qty: '2000', unit: 'kg', pricePerUnit: '92000', totalValue: '184000000',
      deliveryTerms: 'FOB Tanjung Perak', startDate: day(-30), endDate: day(5), status: 'berjalan',
      note: 'Pengiriman bertahap 2×1 ton',
    },
    {
      companyId: cid, code: 'KTR-0002', partnerId: partnersRows[2].id, commodityId: C.JAGUNG.id,
      qty: '10000', unit: 'kg', pricePerUnit: '5300', totalValue: '53000000',
      startDate: day(-7), endDate: day(90), status: 'negosiasi',
    },
  ]);

  // ===== 13) Ekspor =====
  await db.insert(schema.exportShipments).values({
    companyId: cid, code: 'EKS-0001', commodityId: C.KOPI.id, destinationCountry: 'Jepang',
    destinationPort: 'Yokohama', buyerName: 'Sakura Coffee Trading Co.', qty: '1000', unit: 'kg',
    valueAmount: '9500', currency: 'USD', etd: day(20), eta: day(35), status: 'dokumen',
    docs: { invoice: true, packingList: true, coo: false, phytosanitary: false, billOfLading: false },
    warehouseId: W['GDG-02'].id, note: 'Kontainer LCL via freight forwarder',
  });

  // ===== 14) Logistik =====
  await db.insert(schema.deliveries).values([
    {
      companyId: cid, code: 'KRM-0001', deliveryDate: day(-4), origin: 'Gudang Kopi (Ngadas)',
      destination: 'Kedai Kopi Nusantara, Malang', commodityId: C.KOPI.id, qty: '200', unit: 'kg',
      vehicle: 'Pickup L300', driverName: 'Joko', driverPhone: '0812-3333-4444', cost: '350000',
      status: 'selesai', refType: 'pesanan',
    },
    {
      companyId: cid, code: 'KRM-0002', deliveryDate: day(0), origin: 'Gudang Utama',
      destination: 'Pasar Gadang, Malang', commodityId: C.TELUR.id, qty: '20', unit: 'kg',
      vehicle: 'Motor roda tiga', driverName: 'Andi', cost: '50000', status: 'perjalanan', refType: 'pesanan',
    },
  ]);
  await db.insert(schema.finTransactions).values({
    companyId: cid, txDate: day(-4), kind: 'keluar', category: 'transportasi', amount: '350000',
    refType: 'manual', note: 'Ongkos kirim KRM-0001',
  });

  // ===== 15) Transaksi kas manual (sebaran 4 bulan untuk grafik) =====
  await db.insert(schema.finTransactions).values([
    { companyId: cid, txDate: day(-100), kind: 'keluar', category: 'sewa', amount: '3000000', refType: 'manual', note: 'Sewa lahan Blok B setahun' },
    { companyId: cid, txDate: day(-95), kind: 'keluar', category: 'alat', amount: '1500000', refType: 'manual', note: 'Servis traktor tangan' },
    { companyId: cid, txDate: day(-85), kind: 'masuk', category: 'penjualan', amount: '26250000', cycleId: S['SKL-0007'].id, refType: 'manual', note: 'Penjualan cabai borongan 1.050 kg' },
    { companyId: cid, txDate: day(-65), kind: 'keluar', category: 'tenaga_kerja', amount: '2200000', cycleId: S['SKL-0007'].id, refType: 'manual', note: 'Upah panen & sortasi cabai' },
    { companyId: cid, txDate: day(-45), kind: 'masuk', category: 'penjualan', amount: '4200000', refType: 'manual', note: 'Penjualan telur 4 minggu' },
    { companyId: cid, txDate: day(-35), kind: 'keluar', category: 'pembelian_input', amount: '1800000', refType: 'manual', note: 'Benih bawang merah 60 kg' },
    { companyId: cid, txDate: day(-12), kind: 'masuk', category: 'penjualan', amount: '3600000', refType: 'manual', note: 'Penjualan susu segar bulanan' },
  ]);

  // ===== 16) IoT: perangkat + bacaan =====
  const devRows = await db
    .insert(schema.devices)
    .values([
      {
        companyId: cid, code: 'SNS-001', name: 'Sensor Kelembapan Sawah A', deviceType: 'kelembapan_tanah',
        landId: L['LHN-A'].id, unit: '%', minThreshold: '40', maxThreshold: '80',
        apiKey: 'wtd_demo_kelembapan_sawah_a_001',
      },
      {
        companyId: cid, code: 'SNS-002', name: 'Sensor Suhu Kandang Sapi', deviceType: 'suhu_udara',
        landId: L['KDG-E'].id, unit: '°C', minThreshold: '20', maxThreshold: '33',
        apiKey: 'wtd_demo_suhu_kandang_e_002',
      },
      {
        companyId: cid, code: 'SNS-003', name: 'Sensor pH Kebun Kopi', deviceType: 'ph_tanah',
        landId: L['LHN-D'].id, unit: 'pH', minThreshold: '5.5', maxThreshold: '7',
        apiKey: 'wtd_demo_ph_kebun_d_003',
      },
    ])
    .returning();

  // SNS-001: 48 jam per jam, tren menurun → bacaan terakhir DI BAWAH ambang (39) → insight.
  const readings1 = Array.from({ length: 48 }, (_, i) => {
    const h = 47 - i;
    const base = 62 - (47 - h) * 0.5;
    const wave = Math.sin(h / 3.8) * 6;
    return {
      companyId: cid,
      deviceId: devRows[0].id,
      value: String(Math.round(Math.max(30, base + wave) * 10) / 10),
      readAt: hoursAgo(h),
    };
  });
  readings1[readings1.length - 1].value = '38.5';
  await db.insert(schema.deviceReadings).values(readings1);

  // SNS-002: normal (26–31°C), tiap 2 jam.
  await db.insert(schema.deviceReadings).values(
    Array.from({ length: 24 }, (_, i) => {
      const h = (23 - i) * 2;
      return {
        companyId: cid,
        deviceId: devRows[1].id,
        value: String(Math.round((28.5 + Math.sin(h / 7) * 2.5) * 10) / 10),
        readAt: hoursAgo(h),
      };
    }),
  );
  // SNS-003: tidak ada bacaan → insight offline.

  // ===== 17) Penomoran dokumen (lanjut dari data seed) =====
  await db.insert(schema.numberingSequences).values([
    { companyId: cid, docType: 'cycle', prefix: 'SKL-', nextValue: 9 },
    { companyId: cid, docType: 'order', prefix: 'PSN-', nextValue: 4 },
    { companyId: cid, docType: 'deal', prefix: 'KTR-', nextValue: 3 },
    { companyId: cid, docType: 'export', prefix: 'EKS-', nextValue: 2 },
    { companyId: cid, docType: 'delivery', prefix: 'KRM-', nextValue: 3 },
    { companyId: cid, docType: 'listing', prefix: 'LPK-', nextValue: 3 },
  ]);

  console.log('Seed selesai.');
  console.log('Login demo → email: petani@demo.com / kata sandi: petani123 (Admin)');
  console.log('             email: anggota@demo.com / kata sandi: anggota123 (Anggota)');
  await pool.end();
}

void main();
