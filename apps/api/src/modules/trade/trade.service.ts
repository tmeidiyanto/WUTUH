import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { NumberingService } from '../../platform/numbering/numbering.service';
import { getContext } from '../../platform/tenancy/company-context';
import { commodities, deals, finTransactions, partners } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateDealDto, CreatePartnerDto, UpdateDealDto, UpdatePartnerDto } from './dto/trade.dto';

@Injectable()
export class TradeService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly numbering: NumberingService,
  ) {}

  // ---- Mitra ----
  listPartners() {
    return this.uow.run((tx) => tx.select().from(partners).orderBy(partners.name));
  }

  createPartner(dto: CreatePartnerDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [dup] = await tx
        .select()
        .from(partners)
        .where(and(eq(partners.companyId, companyId), eq(partners.code, dto.code)));
      if (dup) throw new ConflictException(msg('partner.codeTaken', { code: dto.code }));
      const [row] = await tx.insert(partners).values({ companyId, ...dto }).returning();
      return row;
    });
  }

  updatePartner(id: string, dto: UpdatePartnerDto) {
    return this.uow.run(async (tx) => {
      const [row] = await tx
        .update(partners)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(partners.id, id))
        .returning();
      if (!row) throw new NotFoundException(msg('partner.notFound'));
      return row;
    });
  }

  // ---- Kontrak B2B ----
  listDeals() {
    return this.uow.run(async (tx) => {
      const rows = await tx
        .select({ d: deals, partnerName: partners.name, commodityName: commodities.name })
        .from(deals)
        .leftJoin(partners, eq(deals.partnerId, partners.id))
        .leftJoin(commodities, eq(deals.commodityId, commodities.id))
        .orderBy(desc(deals.createdAt));
      return rows.map((r) => ({ ...r.d, partnerName: r.partnerName, commodityName: r.commodityName }));
    });
  }

  createDeal(dto: CreateDealDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const code = await this.numbering.next(tx, 'deal');
      const totalValue = String(Number(dto.qty) * Number(dto.pricePerUnit));
      const [row] = await tx
        .insert(deals)
        .values({ companyId, code, ...dto, totalValue })
        .returning();
      return row;
    });
  }

  /** Kontrak 'selesai' → pemasukan penjualan B2B otomatis tercatat. */
  updateDeal(id: string, dto: UpdateDealDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [existing] = await tx.select().from(deals).where(eq(deals.id, id));
      if (!existing) throw new NotFoundException(msg('deal.notFound'));

      const patch: Record<string, unknown> = { ...dto, updatedAt: new Date() };
      const qty = dto.qty ?? existing.qty;
      const price = dto.pricePerUnit ?? existing.pricePerUnit;
      patch.totalValue = String(Number(qty) * Number(price));

      const [row] = await tx.update(deals).set(patch).where(eq(deals.id, id)).returning();

      if (dto.status === 'selesai' && existing.status !== 'selesai') {
        await tx.insert(finTransactions).values({
          companyId,
          txDate: new Date().toISOString().slice(0, 10),
          kind: 'masuk',
          category: 'penjualan',
          amount: row.totalValue,
          refType: 'manual',
          refId: row.id,
          note: `Kontrak B2B ${row.code} selesai`,
        });
      }
      return row;
    });
  }
}
