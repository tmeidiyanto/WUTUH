import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import type { Tx } from '../../platform/db/db.types';
import { commChannels, companies, listings, orders } from '../../platform/db/schema';

/**
 * Skor "Penjual Terverifikasi" — dihitung MURNI dari data nyata usaha, bukan
 * centang manual admin. Tujuannya: pembeli di Pasar WUTUH bisa menilai
 * kredibilitas penjual, dan penjual terdorong melengkapi data & merespons cepat.
 *
 * Komposisi (total 100):
 *  - Ketertelusuran (30) : porsi lapak aktif yang tertaut siklus produksi (punya QR lacak).
 *  - Respons (25)        : porsi pesanan yang ditindaklanjuti (keluar dari status 'baru');
 *                          pesanan menggantung > 48 jam dihitung sebagai lalai.
 *  - Transaksi (25)      : jumlah pesanan selesai 12 bulan terakhir (10+ = penuh).
 *  - Profil (20)         : No. HP, wilayah, QRIS, dan saluran WhatsApp aktif (@5).
 */
export type TrustPart = { score: number; max: number; hint?: string };
export type TrustScore = {
  score: number;
  tier: 'terverifikasi' | 'tepercaya' | 'baru';
  parts: { traceability: TrustPart; response: TrustPart; sales: TrustPart; profile: TrustPart };
};

const STALE_MS = 48 * 3600_000; // pesanan 'baru' menggantung > 48 jam = belum direspons
const YEAR_MS = 365 * 86400_000;
const CACHE_TTL_MS = 5 * 60_000;

@Injectable()
export class TrustService {
  private readonly cache = new Map<string, { at: number; v: TrustScore }>();

  constructor(private readonly uow: UnitOfWork) {}

  /** Skor lengkap (ber-cache 5 menit) untuk satu usaha. */
  async compute(companyId: string): Promise<TrustScore> {
    const hit = this.cache.get(companyId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.v;

    const v = await this.uow.run((tx) => this.calc(tx, companyId), { companyId });
    this.cache.set(companyId, { at: Date.now(), v });
    return v;
  }

  /** Versi ringkas untuk halaman publik (kartu pasar, lacak). */
  async summary(companyId: string): Promise<{ score: number; tier: TrustScore['tier'] }> {
    const { score, tier } = await this.compute(companyId);
    return { score, tier };
  }

  /** Ringkasan banyak usaha sekaligus (kartu Pasar WUTUH). */
  async summaries(companyIds: string[]): Promise<Record<string, { score: number; tier: TrustScore['tier'] }>> {
    const unique = [...new Set(companyIds)];
    const out: Record<string, { score: number; tier: TrustScore['tier'] }> = {};
    for (const id of unique) out[id] = await this.summary(id);
    return out;
  }

  private async calc(tx: Tx, companyId: string): Promise<TrustScore> {
    const now = Date.now();
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId));

    // Ketertelusuran: lapak aktif yang tertaut siklus (pembeli bisa melacak asalnya).
    const ls = await tx
      .select({ cycleId: listings.cycleId })
      .from(listings)
      .where(and(eq(listings.companyId, companyId), eq(listings.status, 'aktif')));
    const traceScore = ls.length ? Math.round((ls.filter((l) => l.cycleId).length / ls.length) * 30) : 0;

    // Respons & transaksi: pesanan 12 bulan terakhir (RLS sudah membatasi ke usaha ini).
    const os = await tx
      .select({ status: orders.status, createdAt: orders.createdAt })
      .from(orders);
    const recent = os.filter((o) => now - new Date(o.createdAt as unknown as string).getTime() < YEAR_MS);
    const basis = recent.filter(
      (o) => o.status !== 'baru' || now - new Date(o.createdAt as unknown as string).getTime() > STALE_MS,
    );
    const responded = basis.filter((o) => o.status !== 'baru').length;
    const responseScore = basis.length ? Math.round((responded / basis.length) * 25) : 0;

    const done = recent.filter((o) => o.status === 'selesai').length;
    const salesScore = Math.round((Math.min(done, 10) / 10) * 25);

    // Profil: kontak & kesiapan berjualan.
    const [wa] = await tx
      .select({ isEnabled: commChannels.isEnabled })
      .from(commChannels)
      .where(and(eq(commChannels.companyId, companyId), eq(commChannels.channel, 'whatsapp')));
    const profileScore =
      (company?.phone ? 5 : 0) +
      (company?.regency || company?.province ? 5 : 0) +
      (company?.qrisUrl ? 5 : 0) +
      (wa?.isEnabled ? 5 : 0);

    const score = traceScore + responseScore + salesScore + profileScore;
    const tier: TrustScore['tier'] = score >= 80 ? 'terverifikasi' : score >= 55 ? 'tepercaya' : 'baru';

    return {
      score,
      tier,
      parts: {
        traceability: { score: traceScore, max: 30 },
        response: { score: responseScore, max: 25 },
        sales: { score: salesScore, max: 25 },
        profile: { score: profileScore, max: 20 },
      },
    };
  }
}
