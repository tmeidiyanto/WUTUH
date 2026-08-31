import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { UnitOfWork } from '../../platform/db/unit-of-work';
import { getContext } from '../../platform/tenancy/company-context';
import { cycles, finTransactions } from '../../platform/db/schema';
import { msg } from '../../shared/errors';
import type { CreateTransactionDto } from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly uow: UnitOfWork) {}

  list(month?: string) {
    return this.uow.run(async (tx) => {
      // month format: yyyy-mm
      let where;
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const start = `${month}-01`;
        const [y, m] = month.split('-').map(Number);
        const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
        where = and(gte(finTransactions.txDate, start), lte(finTransactions.txDate, end));
      }
      const rows = await tx
        .select({ t: finTransactions, cycleCode: cycles.code, cycleName: cycles.name })
        .from(finTransactions)
        .leftJoin(cycles, eq(finTransactions.cycleId, cycles.id))
        .where(where)
        .orderBy(desc(finTransactions.txDate), desc(finTransactions.createdAt))
        .limit(500);
      return rows.map((r) => ({ ...r.t, cycleCode: r.cycleCode, cycleName: r.cycleName }));
    });
  }

  create(dto: CreateTransactionDto) {
    const companyId = getContext().companyId;
    return this.uow.run(async (tx) => {
      const [row] = await tx.insert(finTransactions).values({ companyId, ...dto, refType: 'manual' }).returning();
      return row;
    });
  }

  /** Hanya transaksi manual yang boleh dihapus; entri otomatis dari modul lain terkunci. */
  remove(id: string) {
    return this.uow.run(async (tx) => {
      const [row] = await tx.select().from(finTransactions).where(eq(finTransactions.id, id));
      if (!row) throw new NotFoundException(msg('finance.notFound'));
      if (row.refType !== 'manual' || row.refId) {
        throw new BadRequestException(msg('finance.autoLocked'));
      }
      await tx.delete(finTransactions).where(eq(finTransactions.id, id));
      return { ok: true };
    });
  }

  /** Ringkasan: total masuk/keluar per bulan (12 bulan terakhir) + laba/rugi per siklus. */
  summary() {
    return this.uow.run(async (tx) => {
      const monthly = await tx
        .select({
          month: sql<string>`to_char(${finTransactions.txDate}, 'YYYY-MM')`,
          kind: finTransactions.kind,
          total: sql<string>`sum(${finTransactions.amount})`,
        })
        .from(finTransactions)
        .where(gte(finTransactions.txDate, sql`(current_date - interval '12 months')::date`))
        .groupBy(sql`to_char(${finTransactions.txDate}, 'YYYY-MM')`, finTransactions.kind)
        .orderBy(sql`to_char(${finTransactions.txDate}, 'YYYY-MM')`);

      const byCategory = await tx
        .select({
          category: finTransactions.category,
          kind: finTransactions.kind,
          total: sql<string>`sum(${finTransactions.amount})`,
        })
        .from(finTransactions)
        .groupBy(finTransactions.category, finTransactions.kind);

      const byCycle = await tx
        .select({
          cycleId: finTransactions.cycleId,
          cycleCode: cycles.code,
          cycleName: cycles.name,
          kind: finTransactions.kind,
          total: sql<string>`sum(${finTransactions.amount})`,
        })
        .from(finTransactions)
        .innerJoin(cycles, eq(finTransactions.cycleId, cycles.id))
        .groupBy(finTransactions.cycleId, cycles.code, cycles.name, finTransactions.kind);

      return { monthly, byCategory, byCycle };
    });
  }
}
