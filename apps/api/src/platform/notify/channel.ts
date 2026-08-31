import type { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import type { Tx } from '../db/db.types';
import { commChannels } from '../db/schema';

/** Event notifikasi yang dikenal (dipakai UI & resolver). */
export const NOTIFY_EVENTS = ['order_status_to_buyer', 'new_order_to_seller', 'agenda_reminder'] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export interface WaChannel {
  url: string;
  token: string;
  source: 'company' | 'env';
}

/**
 * Cari konfigurasi WhatsApp yang berlaku untuk sebuah usaha & event:
 *  - Ada baris comm_channels 'whatsapp' → pakai itu (hormati isEnabled + events).
 *  - Tidak ada baris → fallback env WA_GATEWAY_URL/TOKEN (semua event aktif).
 * Mengembalikan null bila tidak boleh/tidak bisa mengirim. Dipanggil DI DALAM
 * transaksi (RLS memastikan baris milik usaha ybs.).
 */
export async function resolveWaChannel(
  tx: Tx,
  config: ConfigService,
  companyId: string,
  event: NotifyEvent | null,
): Promise<WaChannel | null> {
  const [row] = await tx
    .select()
    .from(commChannels)
    .where(and(eq(commChannels.companyId, companyId), eq(commChannels.channel, 'whatsapp')));

  if (row) {
    if (!row.isEnabled) return null;
    if (event && !(row.events ?? []).includes(event)) return null;
    const url = row.config?.gatewayUrl?.trim();
    const token = row.config?.token?.trim();
    if (!url || !token) return null;
    return { url, token, source: 'company' };
  }

  const url = config.get<string>('WA_GATEWAY_URL');
  const token = config.get<string>('WA_GATEWAY_TOKEN');
  if (!url || !token) return null;
  return { url, token, source: 'env' };
}
