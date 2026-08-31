import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { companies } from '../../platform/db/schema';

/**
 * Prakiraan cuaca BMKG (api.bmkg.go.id, publik & gratis) per kelurahan/desa
 * (kode adm4 di companies.weather_code). Cache 30 menit per kode wilayah.
 * Semuanya melapuk anggun: BMKG mati / kode salah → { available: false },
 * aplikasi tetap jalan penuh tanpa cuaca.
 */

export interface WeatherDay {
  date: string;
  tmin: number;
  tmax: number;
  desc: string;
  descEn: string;
  rainMm: number;
}
export interface WeatherSlot {
  local: string;
  t: number;
  hu: number;
  desc: string;
  descEn: string;
  rainMm: number;
  ws: number;
}
export interface WeatherAdvice {
  level: 'warn' | 'info' | 'ok';
  id: string[];
  en: string[];
}
export type Forecast =
  | { configured: false }
  | { configured: true; available: false }
  | {
      configured: true;
      available: true;
      location: { village: string; district: string; regency: string; province: string };
      days: WeatherDay[];
      slots: WeatherSlot[];
      advice: WeatherAdvice;
    };

const CACHE_TTL_MS = 30 * 60_000;
const BMKG_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

@Injectable()
export class WeatherService {
  private readonly cache = new Map<string, { at: number; v: unknown }>();

  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async forecastFor(companyId: string): Promise<Forecast> {
    const [company] = await this.db.select().from(companies).where(eq(companies.id, companyId));
    const code = company?.weatherCode?.trim();
    if (!code) return { configured: false };
    const raw = await this.fetchBmkg(code);
    if (!raw) return { configured: true, available: false };
    try {
      return { configured: true, available: true, ...this.summarize(raw) };
    } catch {
      return { configured: true, available: false };
    }
  }

  /** Validasi kode adm4 dengan memanggil BMKG sekali; kembalikan nama lokasi bila sah. */
  async probe(adm4: string) {
    const raw = (await this.fetchBmkg(adm4)) as any;
    const loc = raw?.lokasi;
    if (!loc?.desa) return null;
    return { village: loc.desa, district: loc.kecamatan, regency: loc.kotkab, province: loc.provinsi };
  }

  private async fetchBmkg(adm4: string): Promise<unknown | null> {
    const hit = this.cache.get(adm4);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.v;
    try {
      const res = await fetch(`${BMKG_URL}?adm4=${encodeURIComponent(adm4)}`, {
        signal: AbortSignal.timeout(8000),
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      if (!json?.lokasi?.desa) return null;
      this.cache.set(adm4, { at: Date.now(), v: json });
      return json;
    } catch {
      return null;
    }
  }

  private summarize(raw: any) {
    const loc = raw.lokasi ?? {};
    const daysRaw: any[][] = raw.data?.[0]?.cuaca ?? [];

    const days: WeatherDay[] = daysRaw.slice(0, 3).map((slots) => {
      const temps = slots.map((s) => Number(s.t)).filter(Number.isFinite);
      const rain = slots.reduce((sum, s) => sum + (Number(s.tp) || 0), 0);
      // Wakil hari: slot siang (±12.00) supaya deskripsinya relevan untuk kerja lapangan.
      const noon =
        slots.find((s) => String(s.local_datetime).includes(' 12:00')) ?? slots[Math.floor(slots.length / 2)] ?? slots[0];
      return {
        date: String(noon?.local_datetime ?? '').slice(0, 10),
        tmin: temps.length ? Math.min(...temps) : 0,
        tmax: temps.length ? Math.max(...temps) : 0,
        desc: noon?.weather_desc ?? '',
        descEn: noon?.weather_desc_en ?? '',
        rainMm: Math.round(rain * 10) / 10,
      };
    });

    // 8 slot terdekat (24 jam, interval 3 jam) mulai dari sekarang.
    const now = Date.now();
    const slots: WeatherSlot[] = daysRaw
      .flat()
      .filter((s) => new Date(String(s.local_datetime).replace(' ', 'T')).getTime() >= now - 90 * 60_000)
      .slice(0, 8)
      .map((s) => ({
        local: String(s.local_datetime),
        t: Number(s.t) || 0,
        hu: Number(s.hu) || 0,
        desc: s.weather_desc ?? '',
        descEn: s.weather_desc_en ?? '',
        rainMm: Number(s.tp) || 0,
        ws: Number(s.ws) || 0,
      }));

    return {
      location: { village: loc.desa ?? '', district: loc.kecamatan ?? '', regency: loc.kotkab ?? '', province: loc.provinsi ?? '' },
      days,
      slots,
      advice: this.advise(days, slots),
    };
  }

  /** Saran WUTUH AI dari prakiraan — aturan sederhana yang bisa langsung dikerjakan petani. */
  private advise(days: WeatherDay[], slots: WeatherSlot[]): WeatherAdvice {
    const id: string[] = [];
    const en: string[] = [];
    const next24 = slots.slice(0, 8);
    const txt = (s: WeatherSlot) => `${s.desc} ${s.descEn}`;

    const heavy = next24.some((s) => /lebat|petir|badai|thunder|heavy|storm/i.test(txt(s)) || s.rainMm >= 10);
    const rainSoon = heavy || next24.some((s) => /hujan|rain|drizzle/i.test(txt(s)) || s.rainMm >= 1);
    const tmax = days[0]?.tmax ?? 0;
    const hot = tmax >= 34;
    const windy = next24.some((s) => s.ws >= 20);

    if (heavy) {
      id.push('Hujan lebat/petir diprakirakan — tunda penyemprotan & pemupukan, periksa saluran drainase lahan.');
      en.push('Heavy rain/thunderstorms expected — postpone spraying & fertilizing, check field drainage.');
    } else if (rainSoon) {
      id.push('Hujan diprakirakan dalam 24 jam — tunda penyemprotan pestisida dan kurangi penyiraman.');
      en.push('Rain expected within 24 hours — postpone pesticide spraying and reduce watering.');
    }
    if (!rainSoon && hot) {
      id.push(`Panas & kering (maks. ${tmax}°C) — siram pagi dan sore, pasang mulsa untuk menahan lengas tanah.`);
      en.push(`Hot & dry (max ${tmax}°C) — water in the morning and evening, use mulch to retain soil moisture.`);
    }
    if (windy && !heavy) {
      id.push('Angin kencang — tunda penyemprotan agar butiran tidak terbawa angin.');
      en.push('Strong winds — postpone spraying so droplets are not blown away.');
    }
    if (!id.length) {
      id.push('Cuaca mendukung — waktu yang baik untuk kegiatan lapangan sesuai agenda Anda.');
      en.push('Weather looks good — a fine window for field work on your agenda.');
    }

    const level: WeatherAdvice['level'] = heavy ? 'warn' : rainSoon || hot || windy ? 'info' : 'ok';
    return { level, id, en };
  }
}
