import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { WeatherService } from '../weather/weather.service';
import { STAGE_LABELS, stageIndex, type Stage } from '../../shared/stages';
import { intlOf, type Lang } from '../../shared/lang';
import type { Tx } from '../../platform/db/db.types';
import {
  agendaTasks,
  commodities,
  cycles,
  deals,
  deviceReadings,
  devices,
  exportShipments,
  listings,
  livestock,
  livestockHealth,
  marketPrices,
  orders,
  stockBalances,
} from '../../platform/db/schema';

export interface Insight {
  severity: 'peluang' | 'perhatian' | 'bahaya' | 'info';
  module: string;
  title: string;
  detail: string;
  route?: string;
}

const STAGE_LABELS_EN: Record<Stage, string> = {
  land: 'Land', planning: 'Planning', planting: 'Planting/Breeding', cultivation: 'Cultivation',
  monitoring: 'Monitoring', harvest: 'Harvest', processing: 'Processing', quality: 'Quality',
  warehouse: 'Warehouse', market: 'Market', logistics: 'Logistics', export: 'Export', customer: 'Customer',
};
const HEALTH_ACTION: Record<Lang, Record<string, string>> = {
  id: { vaksinasi: 'Vaksinasi', pengobatan: 'Pengobatan', pemeriksaan: 'Pemeriksaan', vitamin: 'Vitamin' },
  en: { vaksinasi: 'Vaccination', pengobatan: 'Treatment', pemeriksaan: 'Check-up', vitamin: 'Vitamins' },
};
const DEAL_STATUS_EN: Record<string, string> = { kontrak: 'contracted', berjalan: 'in progress' };
const DOC_LABELS: Record<string, string> = {
  invoice: 'Invoice', packingList: 'Packing List', coo: 'Certificate of Origin',
  phytosanitary: 'Phytosanitary', billOfLading: 'Bill of Lading',
};

/**
 * WUTUH AI — mesin wawasan berbasis aturan yang membaca SELURUH data usaha
 * dan memberi rekomendasi lintas modul. Tidak ada tebak-tebakan: setiap
 * wawasan dihitung dari data nyata milik pengguna. Teks dwibahasa (id/en).
 */
@Injectable()
export class AiService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly weather: WeatherService,
  ) {}

  async insights(lang: Lang = 'id'): Promise<Insight[]> {
    const companyId = getContext().companyId;
    const out = await this.uow.run(async (tx) => {
      const acc: Insight[] = [];
      const L = new Texts(lang);
      // Berurutan (bukan Promise.all): satu transaksi = satu koneksi pg.
      await this.cycleInsights(tx, acc, L);
      await this.priceInsights(tx, acc, L);
      await this.healthInsights(tx, acc, L);
      await this.sensorInsights(tx, acc, L);
      await this.orderInsights(tx, acc, L);
      await this.agendaInsights(tx, acc, L);
      await this.stockOpportunity(tx, acc, L);
      await this.dealInsights(tx, acc, L);
      await this.exportDocInsights(tx, acc, L);
      return acc;
    });
    // Cuaca BMKG di luar transaksi (HTTP eksternal, jangan menahan koneksi pg).
    await this.weatherInsights(companyId, out, lang);
    const rank = { bahaya: 0, perhatian: 1, peluang: 2, info: 3 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  /** Saran cuaca BMKG (bila kode wilayah disetel & BMKG terjangkau). */
  private async weatherInsights(companyId: string, out: Insight[], lang: Lang) {
    const fc = await this.weather.forecastFor(companyId);
    if (!('available' in fc) || !fc.available) return;
    if (fc.advice.level === 'ok') return; // tidak perlu meramaikan daftar saat cuaca aman
    const texts = lang === 'en' ? fc.advice.en : fc.advice.id;
    const place = fc.location.village || fc.location.district;
    out.push({
      severity: fc.advice.level === 'warn' ? 'perhatian' : 'info',
      module: 'AI',
      route: '/',
      title: lang === 'en' ? `Weather advisory for ${place}` : `Saran cuaca untuk ${place}`,
      detail: texts.join(' '),
    });
  }

  /** Siklus lewat target panen / lama tidak diperbarui + prediksi panen. */
  private async cycleInsights(tx: Tx, out: Insight[], L: Texts) {
    const today = new Date().toISOString().slice(0, 10);
    const active = await tx
      .select({ c: cycles, commodityName: commodities.name, unit: commodities.unit, avgYield: commodities.avgYieldPerHa })
      .from(cycles)
      .leftJoin(commodities, eq(cycles.commodityId, commodities.id))
      .where(eq(cycles.status, 'berjalan'));

    for (const { c, commodityName, unit, avgYield } of active) {
      const idx = stageIndex(c.stage);
      if (c.targetHarvestDate && c.targetHarvestDate < today && idx < stageIndex('harvest')) {
        out.push({ severity: 'bahaya', module: 'Farm', route: '/farm/cycles', ...L.overdue(c.name, c.targetHarvestDate, c.stage) });
      }
      const stale = Date.now() - new Date(c.updatedAt).getTime() > 14 * 24 * 3600 * 1000;
      if (stale && idx < stageIndex('harvest')) {
        out.push({ severity: 'perhatian', module: 'Farm', route: '/farm/cycles', ...L.stale(c.name) });
      }
      if ((c.stage === 'cultivation' || c.stage === 'monitoring') && c.areaHa && avgYield) {
        const predicted = Number(c.areaHa) * Number(avgYield);
        const [lastPrice] = await tx
          .select()
          .from(marketPrices)
          .where(eq(marketPrices.commodityId, c.commodityId))
          .orderBy(desc(marketPrices.priceDate))
          .limit(1);
        const value = lastPrice ? Math.round(predicted * Number(lastPrice.pricePerUnit)) : null;
        out.push({ severity: 'info', module: 'AI', route: '/farm/cycles', ...L.forecast(c.name, predicted, unit ?? 'kg', c.areaHa, commodityName ?? '', value) });
      }
    }
  }

  /** Tren harga pasar: bandingkan dua titik harga terakhir per komoditas. */
  private async priceInsights(tx: Tx, out: Insight[], L: Texts) {
    const commods = await tx.select().from(commodities).where(eq(commodities.isActive, true));
    for (const cm of commods) {
      const last2 = await tx
        .select()
        .from(marketPrices)
        .where(eq(marketPrices.commodityId, cm.id))
        .orderBy(desc(marketPrices.priceDate))
        .limit(2);
      if (last2.length < 2) continue;
      const [now, prev] = last2.map((p) => Number(p.pricePerUnit));
      if (!prev) continue;
      const change = ((now - prev) / prev) * 100;
      if (change >= 5) {
        out.push({ severity: 'peluang', module: 'Market', route: '/market/prices', ...L.priceUp(cm.name, change, prev, now, cm.unit) });
      } else if (change <= -5) {
        out.push({ severity: 'perhatian', module: 'Market', route: '/market/prices', ...L.priceDown(cm.name, change, prev, now, cm.unit) });
      }
    }
  }

  /** Jadwal vaksin / tindak lanjut kesehatan ternak dalam 7 hari. */
  private async healthInsights(tx: Tx, out: Insight[], L: Texts) {
    const week = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const due = await tx
      .select({ h: livestockHealth, tag: livestock.tag })
      .from(livestockHealth)
      .innerJoin(livestock, eq(livestockHealth.livestockId, livestock.id))
      .where(and(lte(livestockHealth.nextDueDate, week), inArray(livestock.status, ['sehat', 'sakit', 'bunting'])));
    for (const { h, tag } of due) {
      const overdue = h.nextDueDate! < new Date().toISOString().slice(0, 10);
      out.push({ severity: overdue ? 'bahaya' : 'perhatian', module: 'Ranch', route: '/ranch/records', ...L.healthDue(h.action, tag, overdue, h.nextDueDate!, h.medicine) });
    }
  }

  /** Sensor di luar ambang & perangkat offline. */
  private async sensorInsights(tx: Tx, out: Insight[], L: Texts) {
    const devs = await tx.select().from(devices).where(eq(devices.isActive, true));
    for (const d of devs) {
      const [last] = await tx
        .select()
        .from(deviceReadings)
        .where(eq(deviceReadings.deviceId, d.id))
        .orderBy(desc(deviceReadings.readAt))
        .limit(1);
      if (!last || Date.now() - new Date(last.readAt).getTime() > 24 * 3600 * 1000) {
        out.push({ severity: 'perhatian', module: 'IoT', route: '/iot', ...L.offline(d.name, last ? new Date(last.readAt) : null) });
        continue;
      }
      const v = Number(last.value);
      if (d.maxThreshold != null && v > Number(d.maxThreshold)) {
        out.push({ severity: 'bahaya', module: 'IoT', route: '/iot', ...L.aboveMax(d.name, v, d.unit, d.maxThreshold) });
      } else if (d.minThreshold != null && v < Number(d.minThreshold)) {
        out.push({ severity: 'bahaya', module: 'IoT', route: '/iot', ...L.belowMin(d.name, v, d.unit, d.minThreshold) });
      }
    }
  }

  /** Pesanan baru menunggu konfirmasi > 2 hari. */
  private async orderInsights(tx: Tx, out: Insight[], L: Texts) {
    const stale = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const rows = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.status, 'baru'), lt(orders.createdAt, stale)));
    for (const o of rows) {
      out.push({ severity: 'perhatian', module: 'Market', route: '/market/orders', ...L.orderStale(o.code, o.buyerName, o.orderDate) });
    }
  }

  /** Agenda kalender musim yang jatuh tempo hari ini / terlambat. */
  private async agendaInsights(tx: Tx, out: Insight[], L: Texts) {
    const today = new Date().toLocaleDateString('sv-SE');
    const due = await tx
      .select({ dueDate: agendaTasks.dueDate, title: agendaTasks.title })
      .from(agendaTasks)
      .where(and(sql`${agendaTasks.doneAt} is null`, lte(agendaTasks.dueDate, today)));
    if (!due.length) return;
    const late = due.filter((d) => d.dueDate < today).length;
    out.push({
      severity: late ? 'perhatian' : 'info',
      module: 'Farm',
      route: '/farm/agenda',
      ...L.agendaDue(due.length, late, due[0].title),
    });
  }

  /** Ada stok menganggur tanpa lapak aktif → peluang jualan. */
  private async stockOpportunity(tx: Tx, out: Insight[], L: Texts) {
    const balances = await tx
      .select({
        commodityId: stockBalances.commodityId,
        total: sql<string>`sum(${stockBalances.qty})`,
        unit: sql<string>`min(${stockBalances.unit})`,
        name: sql<string>`min(${commodities.name})`,
      })
      .from(stockBalances)
      .leftJoin(commodities, eq(stockBalances.commodityId, commodities.id))
      .groupBy(stockBalances.commodityId)
      .having(sql`sum(${stockBalances.qty}) > 0`);

    for (const b of balances) {
      const [active] = await tx
        .select()
        .from(listings)
        .where(and(eq(listings.commodityId, b.commodityId), eq(listings.status, 'aktif')))
        .limit(1);
      if (!active) {
        out.push({ severity: 'peluang', module: 'Supply', route: '/market/listings', ...L.unlisted(b.name, Number(b.total), b.unit) });
      }
    }
  }

  /** Kontrak B2B mendekati tanggal akhir tapi belum selesai. */
  private async dealInsights(tx: Tx, out: Insight[], L: Texts) {
    const week = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const rows = await tx
      .select()
      .from(deals)
      .where(and(inArray(deals.status, ['kontrak', 'berjalan']), lte(deals.endDate, week)));
    for (const d of rows) {
      out.push({ severity: 'perhatian', module: 'Trade', route: '/trade/deals', ...L.dealDeadline(d.code, d.endDate!, d.status) });
    }
  }

  /** Dokumen ekspor belum lengkap padahal sudah tahap dokumen/pengapalan. */
  private async exportDocInsights(tx: Tx, out: Insight[], L: Texts) {
    const rows = await tx
      .select()
      .from(exportShipments)
      .where(inArray(exportShipments.status, ['dokumen', 'pengapalan']));
    for (const s of rows) {
      const missing = Object.entries(s.docs)
        .filter(([, v]) => !v)
        .map(([k]) => DOC_LABELS[k] ?? k);
      if (missing.length) {
        out.push({ severity: 'perhatian', module: 'Export', route: '/export', ...L.exportDocs(s.code, missing, s.destinationCountry) });
      }
    }
  }
}

/** Teks wawasan dwibahasa — setiap metode mengembalikan { title, detail }. */
class Texts {
  private readonly nf: Intl.NumberFormat;
  constructor(private readonly lang: Lang) {
    this.nf = new Intl.NumberFormat(intlOf(lang), { maximumFractionDigits: 0 });
  }
  private n(v: number) { return this.nf.format(v); }
  private stage(s: string) { return this.lang === 'en' ? (STAGE_LABELS_EN[s as Stage] ?? s) : (STAGE_LABELS[s as Stage] ?? s); }
  private en() { return this.lang === 'en'; }

  overdue(name: string, date: string, stage: string) {
    return this.en()
      ? { title: `${name} is past its harvest target`, detail: `Target harvest date ${date} has passed but the cycle is still at the ${this.stage(stage)} stage. Check the field as soon as possible.` }
      : { title: `${name} lewat target panen`, detail: `Target panen ${date} sudah lewat tapi siklus masih di tahap ${this.stage(stage)}. Segera periksa kondisi di lapangan.` };
  }
  stale(name: string) {
    return this.en()
      ? { title: `${name} has not been updated recently`, detail: 'No updates for more than 14 days. Log the latest activity to keep the value chain connected.' }
      : { title: `${name} lama tidak diperbarui`, detail: 'Tidak ada pembaruan lebih dari 14 hari. Catat kegiatan terbaru supaya rantai nilai tetap tersambung.' };
  }
  forecast(name: string, qty: number, unit: string, ha: string, commodity: string, value: number | null) {
    const q = this.n(Math.round(qty));
    return this.en()
      ? { title: `Harvest forecast for ${name}`, detail: `Estimated yield ± ${q} ${unit} from ${ha} ha of ${commodity}.${value != null ? ` Estimated value ± Rp ${this.n(value)} (latest market price).` : ''}` }
      : { title: `Prediksi panen ${name}`, detail: `Estimasi hasil ± ${q} ${unit} dari ${ha} ha ${commodity}.${value != null ? ` Perkiraan nilai ± Rp ${this.n(value)} (harga pasar terakhir).` : ''}` };
  }
  priceUp(name: string, pct: number, prev: number, now: number, unit: string) {
    return this.en()
      ? { title: `${name} price up ${pct.toFixed(1)}%`, detail: `From Rp ${this.n(prev)} to Rp ${this.n(now)} per ${unit}. A good time to sell stock.` }
      : { title: `Harga ${name} naik ${pct.toFixed(1)}%`, detail: `Dari Rp ${this.n(prev)} menjadi Rp ${this.n(now)} per ${unit}. Saat yang baik untuk menjual stok.` };
  }
  priceDown(name: string, pct: number, prev: number, now: number, unit: string) {
    const p = Math.abs(pct).toFixed(1);
    return this.en()
      ? { title: `${name} price down ${p}%`, detail: `From Rp ${this.n(prev)} to Rp ${this.n(now)} per ${unit}. Consider holding sales if you can.` }
      : { title: `Harga ${name} turun ${p}%`, detail: `Dari Rp ${this.n(prev)} menjadi Rp ${this.n(now)} per ${unit}. Pertimbangkan menahan penjualan bila memungkinkan.` };
  }
  healthDue(action: string, tag: string, overdue: boolean, date: string, medicine: string | null) {
    const act = HEALTH_ACTION[this.lang][action] ?? action;
    return this.en()
      ? { title: `${act} for ${tag} is ${overdue ? 'overdue' : 'due soon'}`, detail: `Follow-up scheduled ${date}.${medicine ? ` Medicine/vaccine: ${medicine}.` : ''}` }
      : { title: `${act} ternak ${tag} ${overdue ? 'terlambat' : 'segera jatuh tempo'}`, detail: `Jadwal tindak lanjut ${date}.${medicine ? ` Obat/vaksin: ${medicine}.` : ''}` };
  }
  offline(name: string, lastAt: Date | null) {
    const at = lastAt?.toLocaleString(intlOf(this.lang));
    return this.en()
      ? { title: `Device ${name} is offline`, detail: lastAt ? `No data since ${at}. Check the device power/connection.` : 'Has never sent data. Check the device installation.' }
      : { title: `Perangkat ${name} offline`, detail: lastAt ? `Tidak ada data sejak ${at}. Periksa daya/koneksi perangkat.` : 'Belum pernah mengirim data. Periksa pemasangan perangkat.' };
  }
  aboveMax(name: string, v: number, unit: string, max: string) {
    return this.en()
      ? { title: `${name}: ${v}${unit} ABOVE threshold`, detail: `Maximum threshold ${max}${unit}. Check the field right away.` }
      : { title: `${name}: ${v}${unit} di ATAS ambang`, detail: `Ambang maksimum ${max}${unit}. Segera cek kondisi lapangan.` };
  }
  belowMin(name: string, v: number, unit: string, min: string) {
    return this.en()
      ? { title: `${name}: ${v}${unit} BELOW threshold`, detail: `Minimum threshold ${min}${unit}. E.g. low soil moisture → water the plants.` }
      : { title: `${name}: ${v}${unit} di BAWAH ambang`, detail: `Ambang minimum ${min}${unit}. Misal kelembapan rendah → lakukan penyiraman.` };
  }
  orderStale(code: string, buyer: string, date: string) {
    return this.en()
      ? { title: `Order ${code} is not confirmed yet`, detail: `${buyer} ordered on ${date}. Reply quickly so the buyer doesn't walk away.` }
      : { title: `Pesanan ${code} belum dikonfirmasi`, detail: `${buyer} memesan sejak ${date}. Balas cepat supaya pembeli tidak lari.` };
  }
  agendaDue(total: number, late: number, first: string) {
    return this.en()
      ? {
          title: late ? `${this.n(late)} agenda item(s) overdue` : `${this.n(total)} agenda item(s) due today`,
          detail: `Including "${first}". Open the Season Calendar to mark them done — linked tasks are logged to their cycles automatically.`,
        }
      : {
          title: late ? `${this.n(late)} agenda terlambat dikerjakan` : `${this.n(total)} agenda jatuh tempo hari ini`,
          detail: `Termasuk "${first}". Buka Kalender Musim untuk menandai selesai — agenda tertaut siklus otomatis tercatat sebagai kegiatan.`,
        };
  }
  unlisted(name: string, qty: number, unit: string) {
    return this.en()
      ? { title: `${name} stock is not listed yet`, detail: `${this.n(qty)} ${unit} in the warehouse with no active listing. Open a listing in WUTUH Market to sell it.` }
      : { title: `Stok ${name} belum dipasarkan`, detail: `Ada ${this.n(qty)} ${unit} di gudang tanpa lapak aktif. Buka lapak di WUTUH Market untuk menjualnya.` };
  }
  dealDeadline(code: string, endDate: string, status: string) {
    const st = this.en() ? (DEAL_STATUS_EN[status] ?? status) : status;
    return this.en()
      ? { title: `Contract ${code} is approaching its deadline`, detail: `Ends ${endDate} and the status is still '${st}'. Make sure deliveries are fulfilled.` }
      : { title: `Kontrak ${code} mendekati batas waktu`, detail: `Berakhir ${endDate} dan statusnya masih '${st}'. Pastikan pengiriman terpenuhi.` };
  }
  exportDocs(code: string, missing: string[], country: string) {
    return this.en()
      ? { title: `Export documents for ${code} are incomplete`, detail: `Missing: ${missing.join(', ')}. Complete them before shipping to ${country}.` }
      : { title: `Dokumen ekspor ${code} belum lengkap`, detail: `Kurang: ${missing.join(', ')}. Lengkapi sebelum pengapalan ke ${country}.` };
  }
}
