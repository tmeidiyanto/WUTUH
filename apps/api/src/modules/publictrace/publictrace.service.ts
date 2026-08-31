import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import {
  commodities,
  companies,
  cycleActivities,
  cycles,
  cycleStageHistory,
  harvests,
  lands,
  listings,
} from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import { TrustService } from '../trust/trust.service';

/**
 * Halaman lacak publik (/lacak/:kode) — dibuka pembeli dari QR di kemasan/laporan.
 * Lookup kode acak lewat koneksi tanpa konteks (tabel cycles ber-policy longgar
 * saat tanpa konteks), lalu detail dibaca via UoW ber-RLS milik produsen.
 * SANITASI: tanpa data keuangan, tanpa nama pembeli, tanpa biaya kegiatan.
 */
@Injectable()
export class PublicTraceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
    private readonly trust: TrustService,
  ) {}

  async byCode(code: string) {
    const [found] = await this.db.select().from(cycles).where(eq(cycles.traceCode, code));
    if (!found) throw new NotFoundException(msg('trace.notFound'));

    const producerTrust = await this.trust.summary(found.companyId);

    return this.uow.run(
      async (tx) => {
        const [commodity] = await tx.select().from(commodities).where(eq(commodities.id, found.commodityId));
        const land = found.landId ? (await tx.select().from(lands).where(eq(lands.id, found.landId)))[0] ?? null : null;
        const [company] = await tx.select().from(companies).where(eq(companies.id, found.companyId));
        const history = await tx
          .select({ toStage: cycleStageHistory.toStage, at: cycleStageHistory.at, note: cycleStageHistory.note })
          .from(cycleStageHistory)
          .where(eq(cycleStageHistory.cycleId, found.id))
          .orderBy(asc(cycleStageHistory.at));
        const acts = await tx
          .select({
            activityDate: cycleActivities.activityDate,
            activityType: cycleActivities.activityType,
            description: cycleActivities.description,
            photoUrl: cycleActivities.photoUrl,
          })
          .from(cycleActivities)
          .where(eq(cycleActivities.cycleId, found.id))
          .orderBy(asc(cycleActivities.activityDate));
        const hvs = await tx
          .select({
            harvestDate: harvests.harvestDate,
            qty: harvests.qty,
            unit: harvests.unit,
            quality: harvests.quality,
            photoUrl: harvests.photoUrl,
          })
          .from(harvests)
          .where(eq(harvests.cycleId, found.id))
          .orderBy(asc(harvests.harvestDate));
        // Lapak aktif yang tertaut siklus ini → tombol "beli di Pasar WUTUH".
        const [listing] = await tx
          .select({ id: listings.id, title: listings.title })
          .from(listings)
          .where(and(eq(listings.cycleId, found.id), eq(listings.status, 'aktif'), gt(listings.qty, '0')))
          .limit(1);

        return {
          traceCode: code,
          producer: company
            ? {
                name: company.name,
                businessType: company.businessType,
                regency: company.regency,
                province: company.province,
                trust: producerTrust,
              }
            : null,
          cycle: {
            code: found.code,
            name: found.name,
            category: found.category,
            stage: found.stage,
            status: found.status,
            startDate: found.startDate,
            targetHarvestDate: found.targetHarvestDate,
            areaHa: found.areaHa,
          },
          commodity: commodity ? { name: commodity.name, category: commodity.category, unit: commodity.unit } : null,
          land: land ? { name: land.name, landUse: land.landUse, areaHa: land.areaHa, village: land.village } : null,
          history,
          activities: acts,
          harvests: hvs,
          totalHarvest: hvs.reduce((s, h) => s + Number(h.qty), 0),
          listing: listing ?? null,
        };
      },
      { companyId: found.companyId },
    );
  }
}
