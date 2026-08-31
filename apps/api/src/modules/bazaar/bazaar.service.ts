import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, gt, ilike, ne, or, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { companies, commodities, listingPhotos, listings, orders } from '../../platform/db/schema';
import { fireWa } from '../../platform/notify/wa';
import { resolveWaChannel, type WaChannel } from '../../platform/notify/channel';
import { msg } from '../../shared/errors';
import { TrustService } from '../trust/trust.service';
import type { BazaarQueryDto, CreateBazaarOrderDto } from './dto/bazaar.dto';

/**
 * Pasar WUTUH — etalase publik lintas usaha (tanpa login).
 * Query baca memakai koneksi tanpa konteks company: tabel listings & commodities
 * ber-policy RLS longgar saat tanpa konteks (lihat db/sql/rls.sql), companies
 * memang tidak ber-RLS. Penulisan pesanan tetap lewat UoW dengan companyId
 * milik PENJUAL (pola yang sama dengan IoT ingest).
 */
@Injectable()
export class BazaarService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
    private readonly config: ConfigService,
    private readonly trust: TrustService,
  ) {}

  /** Daftar lapak aktif lintas usaha + info penjual. */
  async list(q: BazaarQueryDto) {
    const conds: SQL[] = [eq(listings.status, 'aktif'), gt(listings.qty, '0')];
    if (q.category) conds.push(eq(commodities.category, q.category));
    if (q.search) {
      const s = `%${q.search}%`;
      conds.push(or(ilike(listings.title, s), ilike(commodities.name, s))!);
    }
    const order =
      q.sort === 'termurah' ? asc(listings.pricePerUnit)
      : q.sort === 'termahal' ? desc(listings.pricePerUnit)
      : desc(listings.createdAt);

    const rows = await this.db
      .select({
        id: listings.id,
        code: listings.code,
        companyId: listings.companyId,
        title: listings.title,
        qty: listings.qty,
        unit: listings.unit,
        pricePerUnit: listings.pricePerUnit,
        minOrder: listings.minOrder,
        description: listings.description,
        photoUrl: listings.photoUrl,
        createdAt: listings.createdAt,
        commodityCode: commodities.code,
        commodityName: commodities.name,
        category: commodities.category,
        sellerName: companies.name,
        sellerType: companies.businessType,
        sellerRegency: companies.regency,
        sellerProvince: companies.province,
      })
      .from(listings)
      .innerJoin(commodities, eq(listings.commodityId, commodities.id))
      .innerJoin(companies, eq(listings.companyId, companies.id))
      .where(and(...conds))
      .orderBy(order)
      .limit(60);

    // Lencana kepercayaan penjual per kartu (skor ber-cache per usaha).
    const trustMap = await this.trust.summaries(rows.map((r) => r.companyId));
    return rows.map(({ companyId, ...r }) => ({ ...r, sellerTrust: trustMap[companyId] ?? null }));
  }

  /** Detail lapak + lapak lain dari penjual yang sama. */
  async detail(id: string) {
    const [row] = await this.db
      .select({
        id: listings.id,
        code: listings.code,
        companyId: listings.companyId,
        title: listings.title,
        qty: listings.qty,
        unit: listings.unit,
        pricePerUnit: listings.pricePerUnit,
        minOrder: listings.minOrder,
        description: listings.description,
        photoUrl: listings.photoUrl,
        status: listings.status,
        createdAt: listings.createdAt,
        commodityCode: commodities.code,
        commodityName: commodities.name,
        category: commodities.category,
        sellerName: companies.name,
        sellerType: companies.businessType,
        sellerRegency: companies.regency,
        sellerProvince: companies.province,
        sellerQrisUrl: companies.qrisUrl,
      })
      .from(listings)
      .innerJoin(commodities, eq(listings.commodityId, commodities.id))
      .innerJoin(companies, eq(listings.companyId, companies.id))
      .where(eq(listings.id, id));
    if (!row) throw new NotFoundException(msg('listing.notFound'));

    const others = await this.db
      .select({
        id: listings.id,
        title: listings.title,
        qty: listings.qty,
        unit: listings.unit,
        pricePerUnit: listings.pricePerUnit,
        photoUrl: listings.photoUrl,
        commodityCode: commodities.code,
        commodityName: commodities.name,
        category: commodities.category,
      })
      .from(listings)
      .innerJoin(commodities, eq(listings.commodityId, commodities.id))
      .where(and(eq(listings.companyId, row.companyId), eq(listings.status, 'aktif'), gt(listings.qty, '0'), ne(listings.id, id)))
      .orderBy(desc(listings.createdAt))
      .limit(4);

    // Galeri foto (urut; sampul di depan). Fallback ke photoUrl lama bila galeri kosong.
    const photoRows = await this.db
      .select({ url: listingPhotos.url })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(asc(listingPhotos.sortOrder));
    const photos = photoRows.map((p) => p.url);
    if (!photos.length && row.photoUrl) photos.push(row.photoUrl);

    const sellerTrust = await this.trust.summary(row.companyId);

    // Cukup boolean untuk memilih metode bayar; gambar QRIS baru dikirim setelah pesanan dibuat.
    const { companyId: _cid, sellerQrisUrl, ...safe } = row;
    return { ...safe, sellerHasQris: !!sellerQrisUrl, sellerTrust, photos, others };
  }

  /**
   * Checkout publik: buat pesanan di usaha PENJUAL (status 'baru') + kurangi
   * stok lapak (reservasi; habis → status 'habis'). Balasannya berisi kode
   * pesanan + kontak WhatsApp penjual.
   */
  async createOrder(dto: CreateBazaarOrderDto) {
    const [lst] = await this.db.select().from(listings).where(eq(listings.id, dto.listingId));
    if (!lst) throw new NotFoundException(msg('listing.notFound'));
    if (lst.status !== 'aktif') throw new BadRequestException(msg('listing.inactive'));

    const q = Number(dto.qty);
    if (!(q > 0)) throw new BadRequestException(msg('validation'));
    if (lst.minOrder && q < Number(lst.minOrder)) {
      throw new BadRequestException(msg('bazaar.minOrder', { min: lst.minOrder, unit: lst.unit }));
    }
    const available = Number(lst.qty);
    if (q > available) {
      throw new ConflictException(msg('bazaar.notEnough', { available, unit: lst.unit }));
    }

    const [seller] = await this.db.select().from(companies).where(eq(companies.id, lst.companyId));

    // QRIS hanya sah bila penjual sudah mengunggah gambar QRIS-nya.
    const paymentMethod = dto.paymentMethod ?? 'tunai';
    if (paymentMethod === 'qris' && !seller?.qrisUrl) {
      throw new BadRequestException(msg('payment.qrisNotSet'));
    }

    let sellerChannel: WaChannel | null = null;
    const order = await this.uow.run(
      async (tx) => {
        sellerChannel = await resolveWaChannel(tx, this.config, lst.companyId, 'new_order_to_seller');
        const code = await this.numbering.next(tx, 'order', lst.companyId);
        const note = `[Pasar WUTUH]${dto.note ? ` ${dto.note}` : ''}`;
        const [row] = await tx
          .insert(orders)
          .values({
            companyId: lst.companyId,
            code,
            listingId: lst.id,
            buyerName: dto.buyerName,
            buyerPhone: dto.buyerPhone,
            commodityId: lst.commodityId,
            qty: dto.qty,
            unit: lst.unit,
            pricePerUnit: lst.pricePerUnit,
            total: String(q * Number(lst.pricePerUnit)),
            orderDate: new Date().toISOString().slice(0, 10),
            status: 'baru',
            paymentMethod,
            // Warisi siklus asal lapak → traceability sampai pelanggan & untung/rugi per siklus.
            cycleId: lst.cycleId ?? null,
            note,
          })
          .returning();
        const left = available - q;
        await tx
          .update(listings)
          .set({ qty: String(left), status: left <= 0 ? 'habis' : lst.status, updatedAt: new Date() })
          .where(eq(listings.id, lst.id));
        return row;
      },
      { companyId: lst.companyId },
    );

    // Notifikasi WA otomatis ke PENJUAL (sesuai setelan Saluran Komunikasi usahanya).
    const ch = sellerChannel as WaChannel | null;
    if (ch && seller?.phone) {
      const payInfo = paymentMethod === 'qris' ? 'QRIS (cek pembayaran masuk)' : 'Tunai / bayar di tempat';
      fireWa(
        ch.url,
        ch.token,
        seller.phone,
        `🛒 Pesanan baru ${order.code} di Pasar WUTUH!\n${dto.buyerName} (${dto.buyerPhone}) memesan ${Number(order.qty).toLocaleString('id-ID')} ${order.unit} ${lst.title} — total Rp ${Number(order.total).toLocaleString('id-ID')}.\nPembayaran: ${payInfo}.\nBuka menu Pesanan di WUTUH untuk konfirmasi.`,
      );
    }

    // Nomor WA penjual: 08xx → 628xx (untuk tautan wa.me).
    const digits = (seller?.phone ?? '').replace(/\D/g, '');
    const waPhone = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;

    return {
      code: order.code,
      qty: order.qty,
      unit: order.unit,
      total: order.total,
      title: lst.title,
      sellerName: seller?.name ?? '',
      waPhone: waPhone || null,
      paymentMethod,
      // Gambar QRIS penjual — ditampilkan di layar sukses agar pembeli bisa langsung scan & bayar.
      qrisUrl: seller?.qrisUrl ?? null,
    };
  }
}
