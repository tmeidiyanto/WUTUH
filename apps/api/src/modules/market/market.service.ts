import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fsp } from 'node:fs';
import { basename, join } from 'node:path';
import { and, asc, desc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import type { Tx } from '../../platform/db/db.types';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { getContext } from '../../platform/tenancy/company-context';
import { postStockMovement } from '../../platform/stock/stock.helper';
import { commodities, companies, finTransactions, listingPhotos, listings, marketPrices, orders } from '../../platform/db/schema';
import { fireWa } from '../../platform/notify/wa';
import { resolveWaChannel } from '../../platform/notify/channel';
import { msg } from '../../shared/errors';
import { decodeImageDataUrl } from '../../shared/images';
import type {
  CreateListingDto,
  CreateOrderDto,
  CreatePriceDto,
  UpdateListingDto,
  UpdateOrderStatusDto,
} from './dto/market.dto';

/** Urutan status pesanan; transisi hanya boleh maju (atau ke 'batal' sebelum dikirim). */
const ORDER_FLOW = ['baru', 'dikonfirmasi', 'dikirim', 'selesai'];

@Injectable()
export class MarketService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
    private readonly config: ConfigService,
  ) {}

  // ---- Harga pasar ----
  listPrices(commodityId?: string) {
    return this.uow.run(async (tx) => {
      const where = commodityId ? eq(marketPrices.commodityId, commodityId) : undefined;
      const rows = await tx
        .select({ p: marketPrices, commodityName: commodities.name, commodityCode: commodities.code })
        .from(marketPrices)
        .leftJoin(commodities, eq(marketPrices.commodityId, commodities.id))
        .where(where)
        .orderBy(desc(marketPrices.priceDate))
        .limit(500);
      return rows.map((r) => ({ ...r.p, commodityName: r.commodityName, commodityCode: r.commodityCode }));
    });
  }

  addPrice(dto: CreatePriceDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [row] = await tx.insert(marketPrices).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  // ---- Lapak ----
  listListings() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ l: listings, commodityName: commodities.name })
        .from(listings)
        .leftJoin(commodities, eq(listings.commodityId, commodities.id))
        .orderBy(desc(listings.createdAt));
      return rows.map((r) => ({ ...r.l, commodityName: r.commodityName }));
    });
  }

  createListing(dto: CreateListingDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const code = await this.numbering.next(tx, 'listing');
      const [row] = await tx.insert(listings).values({ companyId, code, ...dto }).returning();
      return row;
    });
  }

  updateListing(id: string, dto: UpdateListingDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(listings)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(listings.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('listing.notFound'));
      return row;
    });
  }

  // ---- Galeri foto produk (maks. MAX_PHOTOS per lapak; sort_order 0 = sampul) ----
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'listings');
  private static readonly MAX_PHOTOS = 5;

  private decodePhoto(dataUrl: string) {
    return decodeImageDataUrl(dataUrl);
  }

  /** Rapikan sort_order 0..n-1 sesuai urutan `ordered` + sinkronkan sampul (listings.photo_url). */
  private async resequencePhotos(tx: Tx, listingId: string, ordered: Array<{ id: string; url: string }>) {
    for (let i = 0; i < ordered.length; i++) {
      await tx.update(listingPhotos).set({ sortOrder: i, updatedAt: new Date() }).where(eq(listingPhotos.id, ordered[i].id));
    }
    await tx
      .update(listings)
      .set({ photoUrl: ordered[0]?.url ?? null, updatedAt: new Date() })
      .where(eq(listings.id, listingId));
  }

  listPhotos(listingId: string) {
    return this.uow.run((tx) =>
      tx.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(asc(listingPhotos.sortOrder)),
    );
  }

  addPhoto(listingId: string, dataUrl: string) {
    const { buf, ext } = this.decodePhoto(dataUrl);
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [lst] = await tx.select().from(listings).where(eq(listings.id, listingId));
      if (!lst) throw new NotFoundException(msg('listing.notFound'));
      const existing = await tx
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId))
        .orderBy(asc(listingPhotos.sortOrder));
      if (existing.length >= MarketService.MAX_PHOTOS) {
        throw new BadRequestException(msg('photo.maxCount', { n: MarketService.MAX_PHOTOS }));
      }

      const fname = `${listingId}-${Date.now()}.${ext}`;
      await fsp.mkdir(this.uploadsDir, { recursive: true });
      await fsp.writeFile(join(this.uploadsDir, fname), buf);
      const url = `/uploads/listings/${fname}`;
      const [row] = await tx
        .insert(listingPhotos)
        .values({ companyId, listingId, url, sortOrder: existing.length })
        .returning();
      if (existing.length === 0) {
        await tx.update(listings).set({ photoUrl: url, updatedAt: new Date() }).where(eq(listings.id, listingId));
      }
      return row;
    });
  }

  deletePhoto(listingId: string, photoId: string) {
    return this.uow.run(async (tx) => {
      const [photo] = await tx
        .select()
        .from(listingPhotos)
        .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)));
      if (!photo) throw new NotFoundException(msg('photo.notFound'));
      await tx.delete(listingPhotos).where(eq(listingPhotos.id, photoId));
      void fsp.unlink(join(this.uploadsDir, basename(photo.url))).catch(() => {});
      const rest = await tx
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId))
        .orderBy(asc(listingPhotos.sortOrder));
      await this.resequencePhotos(tx, listingId, rest);
      return { ok: true };
    });
  }

  /** Jadikan foto tertentu sebagai sampul (pindah ke urutan 0). */
  setCover(listingId: string, photoId: string) {
    return this.uow.run(async (tx) => {
      const all = await tx
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId))
        .orderBy(asc(listingPhotos.sortOrder));
      const target = all.find((p) => p.id === photoId);
      if (!target) throw new NotFoundException(msg('photo.notFound'));
      const ordered = [target, ...all.filter((p) => p.id !== photoId)];
      await this.resequencePhotos(tx, listingId, ordered);
      return ordered;
    });
  }

  // ---- Pesanan ----
  listOrders() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ o: orders, commodityName: commodities.name })
        .from(orders)
        .leftJoin(commodities, eq(orders.commodityId, commodities.id))
        .orderBy(desc(orders.createdAt));
      return rows.map((r) => ({ ...r.o, commodityName: r.commodityName }));
    });
  }

  createOrder(dto: CreateOrderDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      // Pesanan dari lapak → stok lapak dikurangi (reservasi); habis → status 'habis'.
      if (dto.listingId) {
        const [lst] = await tx.select().from(listings).where(eq(listings.id, dto.listingId));
        if (lst) {
          const available = Number(lst.qty);
          const q = Number(dto.qty);
          if (q > available) {
            throw new ConflictException(msg('bazaar.notEnough', { available, unit: lst.unit }));
          }
          const left = available - q;
          await tx
            .update(listings)
            .set({ qty: String(left), status: left <= 0 ? 'habis' : lst.status, updatedAt: new Date() })
            .where(eq(listings.id, lst.id));
        }
      }
      const code = await this.numbering.next(tx, 'order');
      const total = String(Number(dto.qty) * Number(dto.pricePerUnit));
      const [row] = await tx
        .insert(orders)
        .values({ companyId, code, ...dto, total })
        .returning();
      return row;
    });
  }

  /**
   * Transisi status pesanan:
   *  - 'dikirim' → stok keluar dari gudang sumber (bila diisi).
   *  - 'selesai' → pemasukan penjualan otomatis tercatat di WUTUH Finance.
   */
  updateOrderStatus(id: string, dto: UpdateOrderStatusDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!o) throw new NotFoundException(msg('order.notFound'));
      if (o.status === dto.status) return o;
      if (o.status === 'selesai' || o.status === 'batal') {
        throw new BadRequestException(msg(o.status === 'selesai' ? 'order.alreadyDone' : 'order.alreadyCancelled'));
      }
      if (dto.status === 'batal') {
        if (o.status === 'dikirim') throw new BadRequestException(msg('order.shippedNoCancel'));
        // Kembalikan reservasi stok lapak saat pesanan dibatalkan.
        if (o.listingId) {
          const [lst] = await tx.select().from(listings).where(eq(listings.id, o.listingId));
          if (lst) {
            const back = Number(lst.qty) + Number(o.qty);
            await tx
              .update(listings)
              .set({ qty: String(back), status: lst.status === 'habis' ? 'aktif' : lst.status, updatedAt: new Date() })
              .where(eq(listings.id, lst.id));
          }
        }
      } else if (ORDER_FLOW.indexOf(dto.status) <= ORDER_FLOW.indexOf(o.status)) {
        throw new BadRequestException(msg('status.forwardOnly'));
      }

      if (dto.status === 'dikirim' && o.warehouseId) {
        await postStockMovement(tx, {
          companyId,
          warehouseId: o.warehouseId,
          commodityId: o.commodityId,
          direction: 'keluar',
          qty: o.qty,
          unit: o.unit,
          refType: 'pesanan',
          refId: o.id,
          movementDate: new Date().toISOString().slice(0, 10),
          note: `Kirim pesanan ${o.code} (${o.buyerName})`,
        });
      }

      if (dto.status === 'selesai') {
        await tx.insert(finTransactions).values({
          companyId,
          txDate: new Date().toISOString().slice(0, 10),
          kind: 'masuk',
          category: 'penjualan',
          amount: o.total,
          cycleId: o.cycleId,
          refType: 'pesanan',
          refId: o.id,
          note: `Penjualan ${o.code} — ${o.buyerName}`,
        });
      }

      const [row] = await tx
        .update(orders)
        .set({
          status: dto.status,
          // Pesanan selesai dianggap sudah dibayar bila belum ditandai sebelumnya.
          ...(dto.status === 'selesai' && !o.paidAt ? { paidAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id))
        .returning();

      // Notifikasi WA otomatis ke pembeli — sesuai setelan Saluran Komunikasi usaha
      // (Pengaturan > Saluran Komunikasi), fallback env WA_GATEWAY_* bila belum disetel.
      if (row.buyerPhone) {
        const ch = await resolveWaChannel(tx, this.config, row.companyId, 'order_status_to_buyer');
        if (ch) {
          const [cm] = await tx.select().from(commodities).where(eq(commodities.id, row.commodityId));
          const [seller] = await tx.select().from(companies).where(eq(companies.id, row.companyId));
          fireWa(ch.url, ch.token, row.buyerPhone, buyerStatusMessage(row, dto.status, cm?.name ?? '', seller?.name ?? 'Penjual'));
        }
      }
      return row;
    });
  }

  /** Tandai pesanan sudah dibayar (idempoten) + kabari pembeli via WA. */
  markPaid(id: string) {
    return this.uow.run(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!o) throw new NotFoundException(msg('order.notFound'));
      if (o.status === 'batal') throw new BadRequestException(msg('order.alreadyCancelled'));
      if (o.paidAt) return o;

      const [row] = await tx.update(orders).set({ paidAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, id)).returning();

      if (row.buyerPhone) {
        const ch = await resolveWaChannel(tx, this.config, row.companyId, 'order_status_to_buyer');
        if (ch) {
          const [seller] = await tx.select().from(companies).where(eq(companies.id, row.companyId));
          const rp = `Rp ${Number(row.total).toLocaleString('id-ID')}`;
          fireWa(
            ch.url,
            ch.token,
            row.buyerPhone,
            `Halo ${row.buyerName} ✅\nPembayaran ${rp} untuk pesanan ${row.code} sudah KAMI TERIMA. Terima kasih! 🙏\n— ${seller?.name ?? 'Penjual'} · Pasar WUTUH`,
          );
        }
      }
      return row;
    });
  }
}

/** Pesan WA ke pembeli per perubahan status (Bahasa Indonesia — pembeli lokal). */
function buyerStatusMessage(
  o: { code: string; buyerName: string; qty: string; unit: string; total: string },
  status: string,
  commodity: string,
  seller: string,
): string {
  const rp = `Rp ${Number(o.total).toLocaleString('id-ID')}`;
  const item = `${o.code} — ${Number(o.qty).toLocaleString('id-ID')} ${o.unit} ${commodity} (total ${rp})`;
  const foot = `\n— ${seller} · Pasar WUTUH`;
  switch (status) {
    case 'dikonfirmasi':
      return `Halo ${o.buyerName} 🙏\nPesanan ${item} sudah KAMI KONFIRMASI dan sedang disiapkan.${foot}`;
    case 'dikirim':
      return `Halo ${o.buyerName} 🚚\nPesanan ${item} sedang DALAM PENGIRIMAN. Mohon siap menerima ya.${foot}`;
    case 'selesai':
      return `Halo ${o.buyerName} 🎉\nPesanan ${item} sudah SELESAI. Terima kasih sudah berbelanja! 🌾${foot}`;
    case 'batal':
      return `Mohon maaf ${o.buyerName} 🙏\nPesanan ${item} terpaksa KAMI BATALKAN. Silakan balas pesan ini untuk info lebih lanjut.${foot}`;
    default:
      return `Halo ${o.buyerName} 🙏\nPesanan ${item} sudah kami terima dan akan segera diproses.${foot}`;
  }
}
