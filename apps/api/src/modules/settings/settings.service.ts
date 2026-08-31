import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { commChannels, companies } from '../../platform/db/schema';
import { NOTIFY_EVENTS, resolveWaChannel } from '../../platform/notify/channel';
import { sendWaRaw } from '../../platform/notify/wa';
import { msg } from '../../shared/errors';
import { decodeImageDataUrl, deleteUploadFile, saveUploadFile } from '../../shared/images';
import type { TestChannelDto, UpdatePaymentDto, UpsertChannelDto } from './dto/settings.dto';

/** Saluran yang sudah diimplementasikan; sisanya tampil "Segera hadir" di UI. */
const SUPPORTED = ['whatsapp'];
const KNOWN = ['whatsapp', 'email', 'telegram'];

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
    private readonly config: ConfigService,
  ) {}

  /** Daftar saluran + status. Token tidak pernah dikirim balik (hanya hasToken). */
  listChannels() {
    return this.uow.run(async (tx) => {
      const rows = await tx.select().from(commChannels);
      const envReady = !!(this.config.get('WA_GATEWAY_URL') && this.config.get('WA_GATEWAY_TOKEN'));
      return KNOWN.map((channel) => {
        const supported = SUPPORTED.includes(channel);
        const row = rows.find((r) => r.channel === channel);
        if (!supported) return { channel, supported };
        return {
          channel,
          supported,
          isEnabled: row?.isEnabled ?? false,
          events: row?.events ?? [...NOTIFY_EVENTS],
          gatewayUrl: row?.config?.gatewayUrl ?? '',
          hasToken: !!row?.config?.token,
          /** company = pakai setelan sendiri; env = fallback server; none = mati total. */
          source: row ? 'company' : envReady ? 'env' : 'none',
          envFallbackReady: envReady,
        };
      });
    });
  }

  upsertChannel(channel: string, dto: UpsertChannelDto) {
    if (!SUPPORTED.includes(channel)) throw new BadRequestException(msg('channel.unsupported'));
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [existing] = await tx
        .select()
        .from(commChannels)
        .where(and(eq(commChannels.companyId, companyId), eq(commChannels.channel, channel)));

      const gatewayUrl = (dto.config?.gatewayUrl ?? existing?.config?.gatewayUrl ?? '').trim();
      // Token kosong = pertahankan token tersimpan (tidak pernah dikirim balik ke UI).
      const token = dto.config?.token?.trim() ? dto.config.token.trim() : (existing?.config?.token ?? '');
      const events = dto.events ?? existing?.events ?? [...NOTIFY_EVENTS];
      const config = { gatewayUrl, token };

      let row;
      if (existing) {
        [row] = await tx
          .update(commChannels)
          .set({ isEnabled: dto.isEnabled, config, events, updatedAt: new Date() })
          .where(eq(commChannels.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(commChannels)
          .values({ companyId, channel, isEnabled: dto.isEnabled, config, events })
          .returning();
      }
      return { channel: row.channel, isEnabled: row.isEnabled, events: row.events, gatewayUrl, hasToken: !!token, source: 'company' };
    });
  }

  /** Kirim pesan uji memakai konfigurasi yang BERLAKU (setelan usaha, atau fallback env). */
  async testChannel(channel: string, dto: TestChannelDto) {
    if (!SUPPORTED.includes(channel)) throw new BadRequestException(msg('channel.unsupported'));
    const companyId = getContext().companyId;

    const ch = await this.uow.run((tx) => resolveWaChannel(tx, this.config, companyId, null));
    if (!ch) throw new BadRequestException(msg('channel.notConfigured'));

    const [company] = await this.db.select().from(companies).where(eq(companies.id, companyId));
    const target = dto.target?.trim() || company?.phone || '';
    if (!target) throw new BadRequestException(msg('channel.noTarget'));

    const result = await sendWaRaw(
      ch.url,
      ch.token,
      target,
      `✅ Pesan uji dari WUTUH.\nSaluran WhatsApp usaha "${company?.name ?? ''}" berfungsi dengan baik.\n— WUTUH · The Complete Agribusiness Platform`,
    );
    return { ...result, source: ch.source, target };
  }

  // ---- Pembayaran (QRIS) ----
  /** Setelan pembayaran usaha: gambar QRIS untuk checkout Pasar WUTUH. */
  async getPayment() {
    const companyId = getContext().companyId;
    const [company] = await this.db.select().from(companies).where(eq(companies.id, companyId));
    return { qrisUrl: company?.qrisUrl ?? null };
  }

  /** Unggah/ganti/hapus QRIS. Gambar disimpan di uploads/qris/, file lama dihapus. */
  async updatePayment(dto: UpdatePaymentDto) {
    const companyId = getContext().companyId;
    const [company] = await this.db.select().from(companies).where(eq(companies.id, companyId));

    let qrisUrl = company?.qrisUrl ?? null;
    if (dto.removeQris) {
      deleteUploadFile(qrisUrl);
      qrisUrl = null;
    } else if (dto.qrisDataUrl) {
      const { buf, ext } = decodeImageDataUrl(dto.qrisDataUrl);
      const url = await saveUploadFile('qris', `${companyId}-${Date.now()}.${ext}`, buf);
      deleteUploadFile(qrisUrl);
      qrisUrl = url;
    }

    await this.db.update(companies).set({ qrisUrl, updatedAt: new Date() }).where(eq(companies.id, companyId));
    return { qrisUrl };
  }
}
