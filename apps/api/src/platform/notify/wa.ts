import { Logger } from '@nestjs/common';

const logger = new Logger('WaNotify');

/** 08xx → 628xx (format target gateway/wa.me). */
export function waTarget(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export interface WaSendResult {
  ok: boolean;
  status: number;
  detail: string;
}

/**
 * Kirim pesan WhatsApp lewat gateway HTTP (format Fonnte/Wablas: POST
 * { target, message } dengan header Authorization = token). Versi awaitable —
 * dipakai endpoint "kirim pesan uji" agar hasilnya bisa dilaporkan.
 */
export async function sendWaRaw(url: string, token: string, phone: string, message: string): Promise<WaSendResult> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ target: waTarget(phone), message }),
    });
    const detail = (await r.text()).slice(0, 300);
    if (!r.ok) logger.warn(`Gateway WA membalas ${r.status}: ${detail}`);
    else logger.log(`WA terkirim ke ${waTarget(phone)}`);
    return { ok: r.ok, status: r.status, detail };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    logger.warn(`Gateway WA gagal: ${m}`);
    return { ok: false, status: 0, detail: m };
  }
}

/** Fire-and-forget: TIDAK pernah menggagalkan transaksi utama. */
export function fireWa(url: string, token: string, phone: string, message: string) {
  void sendWaRaw(url, token, phone, message);
}
