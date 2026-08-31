import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { STAGES } from '../../shared/stages';
import type { Lang } from '../../shared/lang';
import { AiService } from '../ai/ai.service';
import {
  commodities,
  cycles,
  deviceReadings,
  devices,
  finTransactions,
  lands,
  listings,
  livestock,
  marketPrices,
  orders,
  stockBalances,
} from '../../platform/db/schema';

@Injectable()
export class DashboardService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ai: AiService,
  ) {}

  async overview(lang: Lang = 'id') {
    const data = await this.uow.run(async (tx) => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [landAgg] = await tx
        .select({ count: sql<string>`count(*)`, totalHa: sql<string>`coalesce(sum(${lands.areaHa}), 0)` })
        .from(lands)
        .where(eq(lands.isActive, true));

      const [cycleAgg] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(cycles)
        .where(eq(cycles.status, 'berjalan'));

      const [livestockAgg] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(livestock)
        .where(inArray(livestock.status, ['sehat', 'sakit', 'bunting']));

      const [stockAgg] = await tx
        .select({ lines: sql<string>`count(*)`, totalQty: sql<string>`coalesce(sum(${stockBalances.qty}), 0)` })
        .from(stockBalances)
        .where(sql`${stockBalances.qty} > 0`);

      const cashflow = await tx
        .select({ kind: finTransactions.kind, total: sql<string>`coalesce(sum(${finTransactions.amount}), 0)` })
        .from(finTransactions)
        .where(gte(finTransactions.txDate, monthStartStr))
        .groupBy(finTransactions.kind);

      const [orderAgg] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(orders)
        .where(inArray(orders.status, ['baru', 'dikonfirmasi']));

      const [listingAgg] = await tx
        .select({ count: sql<string>`count(*)` })
        .from(listings)
        .where(eq(listings.status, 'aktif'));

      // Rantai nilai: jumlah siklus berjalan per tahap.
      const stageCounts = await tx
        .select({ stage: cycles.stage, count: sql<string>`count(*)` })
        .from(cycles)
        .where(eq(cycles.status, 'berjalan'))
        .groupBy(cycles.stage);
      const chain = STAGES.map((s) => ({
        stage: s,
        count: Number(stageCounts.find((r) => r.stage === s)?.count ?? 0),
      }));

      // Perangkat online (bacaan < 24 jam).
      const devs = await tx.select().from(devices).where(eq(devices.isActive, true));
      let devicesOnline = 0;
      for (const d of devs) {
        const [last] = await tx
          .select({ readAt: deviceReadings.readAt })
          .from(deviceReadings)
          .where(eq(deviceReadings.deviceId, d.id))
          .orderBy(desc(deviceReadings.readAt))
          .limit(1);
        if (last && Date.now() - new Date(last.readAt).getTime() < 24 * 3600 * 1000) devicesOnline++;
      }

      // Harga pasar terbaru (1 per komoditas, maks 6).
      const priceRows = await tx
        .select({ p: marketPrices, name: commodities.name, unit: commodities.unit })
        .from(marketPrices)
        .leftJoin(commodities, eq(marketPrices.commodityId, commodities.id))
        .orderBy(desc(marketPrices.priceDate))
        .limit(60);
      const seen = new Set<string>();
      const latestPrices: Array<{ name: string | null; unit: string | null; price: string; date: string }> = [];
      for (const r of priceRows) {
        if (seen.has(r.p.commodityId) || latestPrices.length >= 6) continue;
        seen.add(r.p.commodityId);
        latestPrices.push({ name: r.name, unit: r.unit, price: r.p.pricePerUnit, date: r.p.priceDate });
      }

      const income = Number(cashflow.find((c) => c.kind === 'masuk')?.total ?? 0);
      const expense = Number(cashflow.find((c) => c.kind === 'keluar')?.total ?? 0);

      return {
        kpi: {
          lands: Number(landAgg.count),
          landHa: Number(landAgg.totalHa),
          activeCycles: Number(cycleAgg.count),
          livestock: Number(livestockAgg.count),
          stockLines: Number(stockAgg.lines),
          stockQty: Number(stockAgg.totalQty),
          monthIncome: income,
          monthExpense: expense,
          openOrders: Number(orderAgg.count),
          activeListings: Number(listingAgg.count),
          devicesOnline,
          devicesTotal: devs.length,
        },
        chain,
        latestPrices,
      };
    });

    const insights = await this.ai.insights(lang);
    return { ...data, insights: insights.slice(0, 4), insightCount: insights.length };
  }
}
